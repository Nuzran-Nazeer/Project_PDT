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
  const cycle = await Cycle.findById(id).populate(
    "openedBy cancelledBy",
    "name employeeId",
  );
  if (!cycle) throw new AppError("Cycle not found", 404);
  return cycle;
};

// ---------------------------------------------------------------------------
// Who a cycle covers
// ---------------------------------------------------------------------------
//
// NOTHING STORES A ROSTER, and nothing should. A cycle covers an appraisal GROUP, and
// a person's group is derived from their joining date -- so "who is in the April 2026
// cycle" is a question about the people, answered when it is asked. Copying a list of
// members onto the cycle would duplicate a fact that is already true on each record,
// and the two would disagree the first time somebody joins mid-cycle.
//
// TWO CONDITIONS, and the second is the one that is easy to miss. A person is covered
// when their group matches AND they belong to a unit today: someone in no unit has no
// supervisor, and the design says they are not appraised. The technical admin account
// is the standing example.
//
// Anybody excluded by that second condition is still RETURNED, carrying `appraised:
// false` and the reason. Dropping them silently would leave HR looking at a count that
// is short by one with nothing on screen to explain it.
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
      // The one reason a person in the right group is still not covered. Written out
      // rather than left for the screen to infer from a null unit, so the rule lives
      // in one place instead of being restated in every interface that shows this.
      notAppraisedBecause: unit ? null : "Belongs to no unit, so has no supervisor",
    };
  });
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
    .populate("openedBy cancelledBy", "name employeeId")
    .lean();

  // The headcount per card. Counted per GROUP rather than per cycle, because that is
  // what it actually depends on -- two cycles for the same group in different years
  // ask the same question of the same people, and a per-cycle query would run the
  // same count five times for a five-card list.
  //
  // ⚠️ IT IS TODAY'S COUNT, on every card, including a cycle that closed last year.
  // Who belonged to that group in March 2025 is answerable -- the membership records
  // are dated -- but no criterion asks for it, and pretending a historical figure is
  // being shown would be worse than showing a current one plainly labelled.
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

// The people a cycle covers, for the drill-down from its card.
//
// ⚠️ IT CARRIES NO REVIEW STATUS, because there are no reviews. Reviews, feedback and
// self-assessments have no model and no collection yet, so every "where has this person
// got to" question is unanswerable and the screen says so in those words rather than
// inventing a state. When those land, the status belongs HERE, next to the person, and
// the interface should not have to join two calls to show it.
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
