const Cycle = require("../models/cycle.model");
const Review = require("../models/review.model");
const Feedback = require("../models/feedback.model");
const Plan = require("../models/plan.model");
const OrgUnit = require("../models/orgunit.model");
const Audit = require("../models/audit.model");
const AppError = require("../utils/AppError");
const {
  AGGREGATE_FLOOR,
  PUBLISHED_STATES,
  SHARED_COMPETENCIES,
  FAMILY_COMPETENCIES,
  CHECK_IN_MONTH_OFFSETS,
} = require("../config/constants");

// ⚠️ Aggregates only: nothing here returns a name, review, comment or plan, and a group under
// the floor comes back with no figure. Sub-units roll up into the unit under the company.

const READER = "leadership";
const COMPLETED = ["published", "closed"];
const BANDS = [1, 2, 3, 4, 5];

exports.assertMayRead = (actor) => {
  if (!(actor?.roles || []).includes(READER)) {
    throw new AppError("Only leadership can read company reports", 403);
  }
};

const cycleLabel = (cycle) => `${cycle.parGroup} ${cycle.year}`;

const asCycle = (cycle) => ({
  id: String(cycle._id),
  label: cycleLabel(cycle),
  status: cycle.status,
  startDate: cycle.startDate,
  endDate: cycle.endDate,
});

// Newest first, so the first is the one a report opens on.
const completedCycles = () =>
  Cycle.find({ status: { $in: COMPLETED }, cancelledOn: null }).sort({ openedOn: -1 });

const chooseCycle = async (cycleId) => {
  const cycles = await completedCycles();
  if (!cycleId) return { cycles, cycle: cycles[0] || null };

  const cycle = cycles.find((c) => String(c._id) === String(cycleId));
  if (!cycle) throw new AppError("That cycle has no published results to report", 404);
  return { cycles, cycle };
};

// Every unit mapped to the unit directly under the company that it sits in. Someone placed on
// the company itself counts company-wide and in no unit.
const unitMap = async () => {
  const all = await OrgUnit.find().select("name type parentUnitId").lean();
  const byId = new Map(all.map((u) => [String(u._id), u]));
  const company = all.find((u) => u.type === "company");

  const main = all
    .filter((u) => company && String(u.parentUnitId) === String(company._id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const mainOf = (unitId) => {
    let at = byId.get(String(unitId));
    for (let hops = 0; at && hops < all.length; hops += 1) {
      if (company && String(at.parentUnitId) === String(company._id))
        return String(at._id);
      at = byId.get(String(at.parentUnitId));
    }
    return null;
  };

  return {
    groups: [
      { key: "company", name: "Company-wide" },
      ...main.map((u) => ({ key: String(u._id), name: u.name })),
    ],
    mainOf,
  };
};

// The groups a review counts in: always the company, and its unit when it has one.
const groupsFor = (review, mainOf) => {
  const unit = review.snapshot?.unitId ? mainOf(review.snapshot.unitId) : null;
  return unit ? ["company", unit] : ["company"];
};

const suppressed = (group) => ({ ...group, suppressed: true });

const competencyNames = new Map(
  [...SHARED_COMPETENCIES, ...Object.values(FAMILY_COMPETENCIES).flat()].map((c) => [
    c.key,
    c.name,
  ]),
);

const emptyBands = () => Object.fromEntries(BANDS.map((b) => [b, 0]));

// The supervisor's scores on published reviews. ⚠️ No overall rating exists to report: the raw
// and adjusted figures belong to normalisation, so this counts scores and averages nothing.
exports.ratingDistribution = async (actor, { cycleId } = {}) => {
  exports.assertMayRead(actor);
  const { cycles, cycle } = await chooseCycle(cycleId);
  if (!cycle) return { cycles: [], cycle: null, floor: AGGREGATE_FLOOR, groups: [] };

  const { groups, mainOf } = await unitMap();
  const reviews = await Review.find({
    cycleId: cycle._id,
    status: { $in: PUBLISHED_STATES },
  })
    .select("_id snapshot.unitId")
    .lean();

  const records = await Feedback.find({
    reviewId: { $in: reviews.map((r) => r._id) },
    reviewerType: "supervisor",
  })
    .select("reviewId ratings")
    .lean();
  const ratingsFor = new Map(records.map((f) => [String(f.reviewId), f.ratings || []]));

  const tally = new Map(
    groups.map((g) => [
      g.key,
      { people: 0, bands: emptyBands(), competencies: new Map() },
    ]),
  );

  for (const review of reviews) {
    const ratings = ratingsFor.get(String(review._id)) || [];
    for (const key of groupsFor(review, mainOf)) {
      const t = tally.get(key);
      if (!t) continue;
      t.people += 1;

      for (const row of ratings) {
        if (!row.competencyKey) continue;
        if (!t.competencies.has(row.competencyKey)) {
          t.competencies.set(row.competencyKey, {
            people: 0,
            notObserved: 0,
            bands: emptyBands(),
          });
        }
        const c = t.competencies.get(row.competencyKey);
        c.people += 1;

        if (row.notObserved || typeof row.score !== "number") {
          c.notObserved += 1;
          continue;
        }
        c.bands[row.score] += 1;
        t.bands[row.score] += 1;
      }
    }
  }

  return {
    cycles: cycles.map(asCycle),
    cycle: asCycle(cycle),
    floor: AGGREGATE_FLOOR,
    groups: groups.map((group) => {
      const t = tally.get(group.key);
      if (t.people < AGGREGATE_FLOOR) return suppressed(group);

      return {
        ...group,
        suppressed: false,
        people: t.people,
        bands: t.bands,
        // ⚠️ Each competency is floored on its own: a job family's pair is rated for fewer
        // people than the four everybody shares.
        competencies: [...t.competencies.entries()].map(([key, c]) =>
          c.people < AGGREGATE_FLOOR
            ? { key, name: competencyNames.get(key) || key, suppressed: true }
            : {
                key,
                name: competencyNames.get(key) || key,
                suppressed: false,
                people: c.people,
                notObserved: c.notObserved,
                bands: c.bands,
              },
        ),
      };
    }),
  };
};

// Clamped to the end of the shorter month, the same as the check-in windows themselves.
const addMonths = (date, months) => {
  const at = new Date(date);
  const day = at.getDate();
  at.setDate(1);
  at.setMonth(at.getMonth() + months);
  const last = new Date(at.getFullYear(), at.getMonth() + 1, 0).getDate();
  at.setDate(Math.min(day, last));
  return at;
};

// The latest scheduled check-in date already passed for this cycle's plans, or null.
const lastCheckInPoint = (cycle, on) =>
  CHECK_IN_MONTH_OFFSETS.map((m) => addMonths(cycle.endDate, m))
    .filter((due) => due <= on)
    .pop() || null;

const OPEN = ["not_started", "in_progress"];

// Development plans written against this cycle's results and shared with the employee. A draft
// is the supervisor's unfinished work, not progress, so it is left out.
exports.planProgress = async (actor, { cycleId } = {}) => {
  exports.assertMayRead(actor);
  const { cycles, cycle } = await chooseCycle(cycleId);
  if (!cycle) return { cycles: [], cycle: null, floor: AGGREGATE_FLOOR, groups: [] };

  const on = new Date();
  const point = lastCheckInPoint(cycle, on);
  const { groups, mainOf } = await unitMap();

  const reviews = await Review.find({
    cycleId: cycle._id,
    status: { $in: PUBLISHED_STATES },
  })
    .select("_id snapshot.unitId")
    .lean();
  const reviewById = new Map(reviews.map((r) => [String(r._id), r]));

  const plans = await Plan.find({
    reviewId: { $in: reviews.map((r) => r._id) },
    type: "PDP",
    status: { $ne: "draft" },
  })
    .select("reviewId userId status actions.status actions.lastUpdatedAt")
    .lean();

  const blank = () => ({
    people: new Set(),
    actions: { done: 0, in_progress: 0, not_started: 0, carried_forward: 0 },
    stale: 0,
  });
  const tally = new Map(groups.map((g) => [g.key, blank()]));

  for (const plan of plans) {
    const review = reviewById.get(String(plan.reviewId));
    for (const key of groupsFor(review, mainOf)) {
      const t = tally.get(key);
      if (!t) continue;
      t.people.add(String(plan.userId));

      for (const action of plan.actions || []) {
        if (action.status in t.actions) t.actions[action.status] += 1;

        // ⚠️ A suspended plan cannot be updated, so its actions are never counted as stalled:
        // the pause was the system's doing.
        if (
          point &&
          plan.status !== "suspended" &&
          OPEN.includes(action.status) &&
          new Date(action.lastUpdatedAt) < point
        ) {
          t.stale += 1;
        }
      }
    }
  }

  return {
    cycles: cycles.map(asCycle),
    cycle: asCycle(cycle),
    floor: AGGREGATE_FLOOR,
    lastCheckInPoint: point,
    groups: groups.map((group) => {
      const t = tally.get(group.key);
      if (t.people.size < AGGREGATE_FLOOR) return suppressed(group);

      const total = Object.values(t.actions).reduce((a, b) => a + b, 0);
      return {
        ...group,
        suppressed: false,
        people: t.people.size,
        total,
        actions: t.actions,
        stale: t.stale,
      };
    }),
  };
};

// Bare counts, company-wide, per cycle: no names, no units and no content. A cycle's history
// edits are those made from its opening until the same group's next cycle opened.
exports.auditCounts = async (actor) => {
  exports.assertMayRead(actor);

  const cycles = await Cycle.find({ openedOn: { $ne: null }, cancelledOn: null })
    .sort({ openedOn: -1 })
    .lean();

  const rows = [];
  for (const cycle of cycles) {
    const next = cycles
      .filter((c) => c.parGroup === cycle.parGroup && c.openedOn > cycle.openedOn)
      .sort((a, b) => a.openedOn - b.openedOn)[0];

    const reviewIds = await Review.find({ cycleId: cycle._id }).distinct("_id");

    const [reveals, historyEdits] = await Promise.all([
      Audit.countDocuments({
        action: "identity_reveal",
        outcome: "allowed",
        targetId: { $in: reviewIds },
      }),
      Audit.countDocuments({
        action: "history_edit",
        outcome: "allowed",
        at: { $gte: cycle.openedOn, ...(next ? { $lt: next.openedOn } : {}) },
      }),
    ]);

    rows.push({ ...asCycle(cycle), reveals, historyEdits });
  }

  return { cycles: rows };
};
