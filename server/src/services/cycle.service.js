const Cycle = require("../models/cycle.model");
const User = require("../models/user.model");
const UnitMembership = require("../models/unitmembership.model");
const AppError = require("../utils/AppError");
const { toDay, assertOrderedRange, activeOn } = require("../utils/dateRange");
const {
  CYCLE_STAGES,
  CYCLE_CANCELLED,
  NEXT_STAGE,
  CYCLE_CANCEL_WINDOW_DAYS,
} = require("../config/constants");

// The stage order lives in config/constants.js, being a controlled list.

// One live cycle per group per year, checked here for a readable message and again by
// a partial unique index. Cancelled cycles deliberately do not count: the reason to
// cancel is to open a replacement, which counting them would refuse.
const assertNoLiveCycle = async (parGroup, year, excludeId) => {
  const filter = { parGroup, year, cancelledOn: null };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await Cycle.findOne(filter);
  if (!clash) return;

  throw new AppError(
    `The ${parGroup} group already has a ${year} cycle, currently ${clash.status}. Cancel it before opening another.`,
    409,
  );
};

const assertUserExists = async (userId) => {
  const user = await User.findById(userId).select("_id");
  if (!user) throw new AppError("Employee not found", 404);
  return user;
};


exports.getCycleById = async (id) => {
  const cycle = await Cycle.findById(id).populate(
    "openedBy cancelledBy",
    "name employeeId",
  );
  if (!cycle) throw new AppError("Cycle not found", 404);
  return cycle;
};

// ⚠️ NOTHING STORES A ROSTER. A stored list would disagree with the records the first
// time somebody joins mid-cycle.
//
// Two conditions, the second easy to miss: the group must match AND the person must
// belong to a unit, because someone in no unit is not appraised. Those excluded are
// still RETURNED with `appraised: false` and a reason, so HR is not left with a count
// that is short by one and nothing to explain it.
const coverageFor = async (parGroup, on = new Date()) => {
  const day = toDay(on, "date");

  const people = await User.find({ parGroup, status: { $ne: "inactive" } })
    .select("name employeeId designation jobFamily level location status")
    .sort({ name: 1 })
    .lean();

  const memberships = await UnitMembership.find({
    userId: { $in: people.map((p) => p._id) },
    ...activeOn(day),
  })
    .populate("unitId", "name type")
    .lean();

  const unitFor = new Map(memberships.map((m) => [String(m.userId), m.unitId]));

  return people.map((person) => {
    const unit = unitFor.get(String(person._id)) || null;
    return {
      ...person,
      unit,
      appraised: Boolean(unit),
      // Written out rather than inferred from a null unit, so the rule lives once.
      notAppraisedBecause: unit ? null : "Belongs to no unit, so has no supervisor",
    };
  });
};

exports.listCycles = async ({ parGroup, year, status } = {}) => {
  const filter = {};
  if (parGroup) filter.parGroup = parGroup;
  if (year) filter.year = Number(year);
  if (status) filter.status = status;

  const items = await Cycle.find(filter)
    .sort({ year: -1, createdAt: -1 })
    .populate("openedBy cancelledBy", "name employeeId")
    .lean();

  // Per GROUP, not per cycle: a per-cycle query would run the same count five times
  // for a five-card list.
  //
  // ⚠️ TODAY'S count on every card, including a cycle that closed last year.
  const groups = [...new Set(items.map((c) => c.parGroup))];
  const counts = new Map();
  for (const group of groups) {
    const covered = await coverageFor(group);
    counts.set(group, covered.filter((p) => p.appraised).length);
  }

  return {
    items: items.map((c) => ({ ...c, peopleCount: counts.get(c.parGroup) ?? 0 })),
    total: items.length,
  };
};

// ⚠️ Carries no review status, because there are no reviews yet. The screen says so
// rather than inventing a state.
exports.peopleInCycle = async (id) => {
  const cycle = await exports.getCycleById(id);
  const people = await coverageFor(cycle.parGroup);

  return {
    cycle,
    items: people,
    total: people.length,
    appraised: people.filter((p) => p.appraised).length,
  };
};

// Null is a real answer: for most of the year a group is between cycles, and a draft
// does not count because it has not opened.
exports.currentCycleFor = async (parGroup) => {
  if (!parGroup) return null;

  return Cycle.findOne({
    parGroup,
    status: { $in: CYCLE_STAGES.filter((s) => s !== "draft" && s !== "closed") },
  }).sort({ year: -1 });
};


// Always draft: opening is what starts the cancellation clock and records who did
// it.
exports.createCycle = async ({ parGroup, year, startDate, endDate }) => {
  const start = toDay(startDate, "startDate");
  const end = toDay(endDate, "endDate");
  assertOrderedRange(start, end);

  await assertNoLiveCycle(parGroup, Number(year));

  return Cycle.create({
    parGroup,
    year: Number(year),
    startDate: start,
    endDate: end,
    status: "draft",
  });
};

// Forward, one stage at a time.
//
// The target is named by the caller rather than left implicit. "Advance" with no target
// reads fine until somebody double-clicks and skips a stage without noticing; naming
// the stage they expect means a repeated request is refused instead of obeyed.
exports.advanceCycle = async (id, target, userId) => {
  const cycle = await exports.getCycleById(id);

  if (cycle.status === CYCLE_CANCELLED) {
    throw new AppError("This cycle was cancelled, so it cannot be moved on", 409);
  }

  const next = NEXT_STAGE[cycle.status];
  if (!next) {
    throw new AppError(`A ${cycle.status} cycle has nowhere further to go`, 409);
  }

  if (target !== next) {
    const known = CYCLE_STAGES.includes(target);
    throw new AppError(
      known
        ? `A cycle moves one stage at a time. This one is ${cycle.status}, so the only move is to ${next}.`
        : `${target} is not a cycle stage`,
      known ? 409 : 400,
    );
  }

  // Opening is the one transition that records anything beyond the stage itself, and
  // both of those recordings are load bearing: `openedOn` starts the cancellation
  // clock, and without it the 30-day rule has nothing to measure from.
  if (next === "open") {
    await assertUserExists(userId);
    cycle.openedBy = userId;
    cycle.openedOn = new Date();
  }

  cycle.status = next;
  await cycle.save();
  return cycle;
};

// ⚠️ CANCEL IS NOT DELETE. Nothing removes a cycle at any stage: a published one is
// somebody's appraisal record. This sets a status and records why.
exports.cancelCycle = async (id, reason, userId) => {
  const cycle = await exports.getCycleById(id);

  if (cycle.status === CYCLE_CANCELLED) {
    throw new AppError("This cycle has already been cancelled", 409);
  }

  const trimmed = String(reason || "").trim();
  if (!trimmed) {
    throw new AppError("A written reason is required to cancel a cycle", 400);
  }

  // ⚠️ A READING OF AN AMBIGUOUS RULE, flagged rather than assumed. §2.9 says HR may
  // cancel "an open cycle" within 30 days of it opening. A DRAFT has never opened, so
  // the window has nothing to measure from and the rule cannot be applied to it
  // literally -- but refusing outright would leave a mistaken draft in the collection
  // forever, since nothing deletes. Cancelling a draft is allowed here with no window,
  // and it is the narrow case: nobody has been told the cycle exists.
  //
  // Anything past `open` is refused. By then the cycle is collecting real work, which
  // is exactly what the 30-day guarantee exists to protect.
  if (cycle.status !== "draft" && cycle.status !== "open") {
    throw new AppError(
      `A cycle can only be cancelled while it is a draft or open. This one is ${cycle.status}.`,
      409,
    );
  }

  if (cycle.status === "open") {
    // Checked BEFORE the arithmetic, not after. `new Date(null)` is the epoch, so a
    // missing opening date would quietly become "opened in 1970" and every cancel
    // would be refused as far too late. Only reachable if a cycle was opened without
    // recording when, which the advance path makes impossible -- so failing loudly is
    // right.
    if (!cycle.openedOn) {
      throw new AppError(
        "This cycle has no opening date recorded, so its cancellation window cannot be worked out",
        409,
      );
    }

    const daysOpen = Math.floor(
      (Date.now() - new Date(cycle.openedOn).getTime()) / 86400000,
    );

    if (daysOpen > CYCLE_CANCEL_WINDOW_DAYS) {
      throw new AppError(
        `A cycle can only be cancelled within ${CYCLE_CANCEL_WINDOW_DAYS} days of opening. This one opened ${daysOpen} days ago.`,
        409,
      );
    }
  }

  await assertUserExists(userId);

  cycle.status = CYCLE_CANCELLED;
  cycle.cancelledOn = new Date();
  cycle.cancelledBy = userId;
  cycle.cancelReason = trimmed;

  await cycle.save();
  return cycle;
};
