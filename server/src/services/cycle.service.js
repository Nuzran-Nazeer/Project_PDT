const Cycle = require("../models/cycle.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { toDay, assertOrderedRange } = require("../utils/dateRange");
const {
  CYCLE_STAGES,
  CYCLE_CANCELLED,
  NEXT_STAGE,
  CYCLE_CANCEL_WINDOW_DAYS,
} = require("../config/constants");

// Creating an appraisal cycle and moving it through its stages.
//
// A cycle is the container every review, every piece of feedback and every development
// plan eventually hangs off. This file owns the rules about ITS OWN lifecycle and
// nothing else: who is in it, what gets written in it and when those close are all
// later stories.
//
// The stage order lives in config/constants.js, not here, so a rule that is really a
// controlled list is not buried in a service.

// ---------------------------------------------------------------------------
// One live cycle per group per year
// ---------------------------------------------------------------------------
// Criterion 2. Checked here for a readable message, and again by a partial unique index
// for anything that reaches the collection another way.
//
// CANCELLED CYCLES DO NOT COUNT, and that is deliberate rather than an oversight. The
// reason to cancel inside 30 days is to open a replacement; counting the cancelled one
// would refuse that replacement for the rest of the year and make cancelling useless.
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

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

exports.getCycleById = async (id) => {
  const cycle = await Cycle.findById(id).populate("openedBy cancelledBy", "name employeeId");
  if (!cycle) throw new AppError("Cycle not found", 404);
  return cycle;
};

exports.listCycles = async ({ parGroup, year, status } = {}) => {
  const filter = {};
  if (parGroup) filter.parGroup = parGroup;
  if (year) filter.year = Number(year);
  if (status) filter.status = status;

  // Newest first. Anybody opening this list is looking for what is running now, not
  // for the first cycle the company ever ran.
  const items = await Cycle.find(filter)
    .sort({ year: -1, createdAt: -1 })
    .populate("openedBy cancelledBy", "name employeeId");

  return { items, total: items.length };
};

// Criterion 8. The cycle a group is in right now, or null.
//
// NULL IS A REAL ANSWER, not a missing one: for most of the year a group is between
// cycles, and a caller that treats null as an error will report a fault on an ordinary
// day. A draft does not count -- it has not opened, so the group is not in it yet.
exports.currentCycleFor = async (parGroup) => {
  if (!parGroup) return null;

  return Cycle.findOne({
    parGroup,
    status: { $in: CYCLE_STAGES.filter((s) => s !== "draft" && s !== "closed") },
  }).sort({ year: -1 });
};

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

// Always created in draft. Nothing may create a cycle that is already open, because
// opening is what starts the cancellation clock and records who did it.
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

// Criterion 3: forward, one stage at a time.
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

// Criteria 5 and 6.
//
// CANCEL IS NOT DELETE (§5.4, LOCKED). Nothing removes a cycle at any stage: a
// published one is somebody's appraisal record and the evidence the process was
// followed. This sets a status and records why.
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
