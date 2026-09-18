const Cycle = require("../models/cycle.model");
const Feedback = require("../models/feedback.model");
const OrgUnit = require("../models/orgunit.model");
const Review = require("../models/review.model");
const User = require("../models/user.model");
const UnitMembership = require("../models/unitmembership.model");
const UnitLead = require("../models/unitlead.model");
const AppError = require("../utils/AppError");
const { hasSettled } = require("./feedback.window");
const { pendingSendBack } = require("./summaryCheck.state");
const { hasColleagueSection } = require("../config/constants");
const { toDay, activeOn, overlapping } = require("../utils/dateRange");
const { membershipOn } = require("./unitmembership.service");
const { leadOn, listLeads } = require("./unitlead.service");
const { currentCycleFor, cycleOn } = require("./cycle.service");

// ⚠️ The one place that answers who supervises whom. Derived every time, never stored:
// a `supervisorId` would be unanswerable for past dates. No unit means null, a real answer.

// `skipUserId` stops the root's lead coming back as their own supervisor.
const climbToLead = async (startUnitId, day, skipUserId) => {
  const seen = new Set();
  let cursor = startUnitId;

  while (cursor) {
    const step = String(cursor);

    if (seen.has(step)) {
      throw new AppError("The unit tree above this unit contains a loop", 409);
    }
    seen.add(step);

    const unit = await OrgUnit.findById(step).select("name type parentUnitId");
    if (!unit) return null;

    const record = await leadOn(step, day);
    const leadUser = record ? record.userId : null;

    if (leadUser && String(leadUser._id) !== String(skipUserId)) {
      return { user: leadUser, unit };
    }

    cursor = unit.parentUnitId;
  }

  return null;
};

const asPerson = (user) =>
  user ? { id: user._id, name: user.name, employeeId: user.employeeId } : null;

const asUnit = (unit) =>
  unit ? { id: unit._id, name: unit.name, type: unit.type } : null;

const asLead = (found) =>
  found ? { ...asPerson(found.user), leadsUnit: asUnit(found.unit) } : null;

exports.reportingLineOn = async (userId, date) => {
  const user = await User.findById(userId).select("_id name employeeId");
  if (!user) throw new AppError("Employee not found", 404);

  const day = toDay(date, "on");
  const membership = await membershipOn(userId, day);

  if (!membership) {
    return {
      employee: asPerson(user),
      on: day.toISOString().slice(0, 10),
      unit: null,
      supervisor: null,
      resolvedUpward: false,
      skipLevel: null,
    };
  }

  const ownUnit = await OrgUnit.findById(membership.unitId).select(
    "name type parentUnitId",
  );

  // Units are never deleted, so a missing one is database surgery: fail loudly.
  if (!ownUnit) {
    throw new AppError(
      "This person's unit no longer exists, so their reporting line cannot be worked out",
      409,
    );
  }

  const supervisor = await climbToLead(ownUnit._id, day, user._id);

  // The lead of the unit above their own, not "the supervisor's supervisor".
  const skipLevel = ownUnit.parentUnitId
    ? await climbToLead(ownUnit.parentUnitId, day, user._id)
    : null;

  return {
    employee: asPerson(user),
    on: day.toISOString().slice(0, 10),
    unit: asUnit(ownUnit),
    supervisor: asLead(supervisor),
    resolvedUpward: Boolean(
      supervisor && String(supervisor.unit._id) !== String(ownUnit._id),
    ),
    skipLevel: asLead(skipLevel),
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 365.25 / 12;

// Who supervised somebody across [from, to), as one period per change of unit or lead. The
// same [from, to) convention as the history records. Days in no unit are left out.
exports.supervisorPeriods = async (userId, from, to) => {
  const inside = (d) => d && d.getTime() > from.getTime() && d.getTime() < to.getTime();
  const points = new Set([from.getTime()]);

  const memberships = await UnitMembership.find({
    userId,
    ...overlapping(from, to),
  }).select("from to");
  const leads = await UnitLead.find(overlapping(from, to)).select("from to");
  for (const record of [...memberships, ...leads]) {
    for (const d of [record.from, record.to]) if (inside(d)) points.add(d.getTime());
  }

  const days = [...points].sort((a, b) => a - b).map((ms) => new Date(ms));
  const periods = [];

  for (let i = 0; i < days.length; i += 1) {
    const day = days[i];
    const until = days[i + 1] || to;

    const membership = await membershipOn(userId, day);
    if (!membership) continue;

    const lead = await climbToLead(membership.unitId, day, userId);
    const supervisorId = lead ? lead.user._id : null;
    const last = periods[periods.length - 1];

    const continues =
      last &&
      last.to.getTime() === day.getTime() &&
      String(last.unitId) === String(membership.unitId) &&
      String(last.supervisorId) === String(supervisorId);

    if (continues) last.to = until;
    else periods.push({ supervisorId, unitId: membership.unitId, from: day, to: until });
  }

  return periods.map((p) => ({
    ...p,
    months: Math.round(((p.to - p.from) / DAY_MS / DAYS_PER_MONTH) * 10) / 10,
  }));
};

// ⚠️ Must stay the exact mirror of climbToLead, or somebody can be supervised by a person
// whose team they do not appear on. `active` is not filtered: it carries no date.
const unitsSupervisedFrom = async (rootUnitId, day) => {
  const collected = [];
  const seen = new Set();
  const queue = [{ id: rootUnitId, viaVacancy: false }];

  while (queue.length) {
    const { id, viaVacancy } = queue.shift();
    const step = String(id);

    if (seen.has(step)) continue;
    seen.add(step);

    collected.push({ id, viaVacancy });

    const children = await OrgUnit.find({ parentUnitId: id }).select("_id");
    for (const child of children) {
      const childLead = await leadOn(child._id, day);
      if (childLead) continue;
      queue.push({ id: child._id, viaVacancy: true });
    }
  }

  return collected;
};

// ⚠️ The supervisor's own record decides the state as soon as one exists: a review already
// written must never read as unstarted when a late colleague record appears.
const stateFrom = (own, missing, cycle) => {
  if (own && hasSettled(own)) {
    return cycle?.status === "normalising"
      ? "normalisation_ready"
      : "awaiting_normalisation";
  }

  if (own?.submittedAt) return "submitted";
  if (own?.status === "draft") return "draft";

  return missing.selfAssessment || missing.colleagues ? "waiting" : "ready";
};

// ⚠️ Every assigned colleague has to be in, not the minimum: a summary written from six
// of eight cannot have the other two folded in afterwards. Settled, never submitted.
const readinessFrom = (records = [], cycle = null) => {
  const self = records.find((r) => r.reviewerType === "self");
  const peers = records.filter((r) => r.reviewerType === "peer");

  // A pool below the display minimum is never shown, so nothing waits on it.
  const colleagues = hasColleagueSection(peers.length)
    ? peers.filter((record) => !hasSettled(record)).length
    : 0;

  const missing = {
    selfAssessment: !(self && hasSettled(self)),
    colleagues,
  };

  return {
    state: stateFrom(
      records.find((r) => r.reviewerType === "supervisor"),
      missing,
      cycle,
    ),
    missing,
  };
};

exports.readinessOn = async (reviewId) => {
  const records = await Feedback.find({ reviewId }).select(
    "reviewId reviewerType status submittedAt locksAt",
  );

  const review = await Review.findById(reviewId).select("cycleId");
  const cycle = review ? await Cycle.findById(review.cycleId).select("status") : null;

  return readinessFrom(records, cycle);
};

// Null until publication. The acknowledgement is how a supervisor knows the review is closed.
const asResult = (review) =>
  review?.publishedAt
    ? { publishedAt: review.publishedAt, acknowledgedAt: review.acknowledgedAt }
    : null;

// ⚠️ No coverage check: a reader role can ask about anybody's team.
exports.teamOn = async (userId, date) => {
  const user = await User.findById(userId).select("_id name employeeId");
  if (!user) throw new AppError("Employee not found", 404);

  const day = toDay(date, "on");
  const { items: leadRecords } = await listLeads({ userId, on: day });

  // Keyed by unit so a shared leaderless descendant is collected once; direct beats via vacancy.
  const byUnit = new Map();
  for (const record of leadRecords) {
    const rootId = record.unitId?._id || record.unitId;
    if (!rootId) continue;

    for (const found of await unitsSupervisedFrom(rootId, day)) {
      const key = String(found.id);
      if (!byUnit.has(key) || !found.viaVacancy) byUnit.set(key, found);
    }
  }

  const unitIds = [...byUnit.values()].map((u) => u.id);

  // Status is not filtered: a leaver drops out through the dates.
  const memberships = unitIds.length
    ? await UnitMembership.find({ unitId: { $in: unitIds }, ...activeOn(day) })
        .populate("userId", "name employeeId designation parGroup")
        .populate("unitId", "name type")
    : [];

  // The root's lead can also be a member of it.
  const members = memberships.filter(
    (m) => m.userId && String(m.userId._id) !== String(user._id),
  );

  // ⚠️ A team spans appraisal groups, so the cycle is looked up per group, never taken
  // from the supervisor. A past day gets the cycle that covered it; today gets the live one.
  const isToday = day.getTime() === toDay(new Date(), "on").getTime();
  const cycleByGroup = new Map();
  for (const group of new Set(members.map((m) => m.userId.parGroup).filter(Boolean))) {
    const cycle = isToday ? await currentCycleFor(group) : await cycleOn(group, day);
    cycleByGroup.set(
      group,
      cycle
        ? {
            id: cycle._id,
            parGroup: cycle.parGroup,
            year: cycle.year,
            startDate: cycle.startDate,
            status: cycle.status,
          }
        : null,
    );
  }

  const cycleIds = [...cycleByGroup.values()].filter(Boolean).map((c) => c.id);
  const reviews = cycleIds.length
    ? await Review.find({
        cycleId: { $in: cycleIds },
        userId: { $in: members.map((m) => m.userId._id) },
      }).select("_id cycleId userId checks publishedAt acknowledgedAt")
    : [];

  const reviewIdByPerson = new Map(
    reviews.map((r) => [`${r.cycleId}:${r.userId}`, String(r._id)]),
  );
  const reviewById = new Map(reviews.map((r) => [String(r._id), r]));

  // ⚠️ `reviewerId` stays unselected: readiness is arithmetic about records, not authors.
  const records = reviews.length
    ? await Feedback.find({ reviewId: { $in: reviews.map((r) => r._id) } }).select(
        "reviewId reviewerType status submittedAt locksAt",
      )
    : [];

  const byReview = new Map();
  for (const record of records) {
    const key = String(record.reviewId);
    if (!byReview.has(key)) byReview.set(key, []);
    byReview.get(key).push(record);
  }

  const team = members
    .map((m) => {
      const cycle = cycleByGroup.get(m.userId.parGroup) || null;
      const reviewId = cycle
        ? reviewIdByPerson.get(`${cycle.id}:${m.userId._id}`) || null
        : null;
      const own = (byReview.get(reviewId) || []).find(
        (r) => r.reviewerType === "supervisor",
      );

      return {
        ...asPerson(m.userId),
        designation: m.userId.designation,
        unit: asUnit(m.unitId),
        parGroup: m.userId.parGroup || null,
        cycle,
        reviewId,
        readiness: reviewId ? readinessFrom(byReview.get(reviewId), cycle) : null,
        sentBack: Boolean(reviewId && pendingSendBack(reviewById.get(reviewId), own)),
        result: asResult(reviewById.get(reviewId)),
        viaVacancy: byUnit.get(String(m.unitId?._id))?.viaVacancy || false,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    supervisor: asPerson(user),
    on: day.toISOString().slice(0, 10),
    leads: leadRecords.map((record) => asUnit(record.unitId)),
    team,
    total: team.length,
  };
};
