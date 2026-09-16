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

// Cancelled cycles do not count: the reason to cancel is to open a replacement.
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

// ⚠️ Nothing stores a roster. The group must match and the person must belong to a unit;
// those in no unit are still returned, flagged, so a short count has an explanation.
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
      notAppraisedBecause: unit ? null : "Belongs to no unit, so has no supervisor",
    };
  });
};

// `inScope` narrows the headcount to the people the caller may see.
exports.listCycles = async ({ parGroup, year, status } = {}, inScope = () => true) => {
  const filter = {};
  if (parGroup) filter.parGroup = parGroup;
  if (year) filter.year = Number(year);
  if (status) filter.status = status;

  const items = await Cycle.find(filter)
    .sort({ year: -1, createdAt: -1 })
    .populate("openedBy cancelledBy", "name employeeId")
    .lean();

  // ⚠️ Today's count on every card, including a cycle that closed last year.
  const groups = [...new Set(items.map((c) => c.parGroup))];
  const counts = new Map();
  for (const group of groups) {
    const covered = await coverageFor(group);
    counts.set(group, covered.filter((p) => p.appraised && inScope(p._id)).length);
  }

  return {
    items: items.map((c) => ({ ...c, peopleCount: counts.get(c.parGroup) ?? 0 })),
    total: items.length,
  };
};

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

// Null for most of the year: a group is between cycles, and a draft has not opened.
exports.currentCycleFor = async (parGroup) => {
  if (!parGroup) return null;

  return Cycle.findOne({
    parGroup,
    status: { $in: CYCLE_STAGES.filter((s) => s !== "draft" && s !== "closed") },
  }).sort({ year: -1 });
};

// The cycle a group was in on a past day, closed ones included. Not for today: a cycle can be
// live before its start date, which only `currentCycleFor` sees.
exports.cycleOn = async (parGroup, day) => {
  if (!parGroup) return null;

  return Cycle.findOne({
    parGroup,
    startDate: { $lte: day },
    endDate: { $gte: day },
    status: { $nin: ["draft", "cancelled"] },
  }).sort({ year: -1 });
};

// Always draft: opening is what starts the cancellation clock.
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

// The caller names the target stage, so a double-click is refused rather than obeyed.
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

  // `openedOn` is what the cancellation window measures from.
  if (next === "open") {
    await assertUserExists(userId);
    cycle.openedBy = userId;
    cycle.openedOn = new Date();
  }

  // Before the stage changes, so a failure leaves the cycle where it was.
  // ⚠️ Required here, not at the top: review.service requires this file, and a circular
  // require at load time hands one side an empty exports object.
  if (next === "collecting") {
    const { openReviewsForCycle } = require("./review.service");
    await openReviewsForCycle(cycle._id);
  }

  cycle.status = next;
  await cycle.save();
  return cycle;
};

// ⚠️ Cancel is not delete: a published cycle is somebody's appraisal record.
exports.cancelCycle = async (id, reason, userId) => {
  const cycle = await exports.getCycleById(id);

  if (cycle.status === CYCLE_CANCELLED) {
    throw new AppError("This cycle has already been cancelled", 409);
  }

  const trimmed = String(reason || "").trim();
  if (!trimmed) {
    throw new AppError("A written reason is required to cancel a cycle", 400);
  }

  // A draft has never opened, so it has no window: cancelling one is allowed at any time,
  // since nothing else can remove a mistaken draft.
  if (cycle.status !== "draft" && cycle.status !== "open") {
    throw new AppError(
      `A cycle can only be cancelled while it is a draft or open. This one is ${cycle.status}.`,
      409,
    );
  }

  if (cycle.status === "open") {
    // ⚠️ Checked before the arithmetic: `new Date(null)` is 1970, and every cancel would
    // be refused as far too late.
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
