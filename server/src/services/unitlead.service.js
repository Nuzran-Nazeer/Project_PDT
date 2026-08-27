const UnitLead = require("../models/unitlead.model");
const UnitMembership = require("../models/unitmembership.model");
const OrgUnit = require("../models/orgunit.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const {
  toDay,
  assertOrderedRange,
  activeOn,
  overlapping,
} = require("../utils/dateRange");

// Supervision is read out of this collection rather than stored. This file only
// RECORDS; answering "who supervises whom" belongs to supervision.service.js.

const assertUserExists = async (userId) => {
  const user = await User.findById(userId).select("_id name");
  if (!user) throw new AppError("Employee not found", 404);
  return user;
};

// ⚠️ Goes beyond what the design states: appointing a lead to a unit that no longer
// operates would undo what discontinuing just did. Only `appointLead` calls this, so
// closing a term inside a discontinued unit still works.
const assertUnitExists = async (unitId) => {
  const unit = await OrgUnit.findById(unitId).select("_id name parentUnitId active");
  if (!unit) throw new AppError("Unit not found", 404);
  if (!unit.active) {
    throw new AppError(
      `${unit.name} has been discontinued, so it cannot be given a lead`,
      409,
    );
  }
  return unit;
};

// A unit has at most one lead on any date
// Scoped to the UNIT, not the person: one person leading two units at once is
// ordinary in a company this size, while one unit having two leads at once makes
// "the lead of your unit on that date" ambiguous, which is the one thing supervision
// cannot be.
const assertUnitHasNoOtherLead = async (unitId, from, to, excludeId) => {
  const filter = { unitId, ...overlapping(from, to) };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await UnitLead.findOne(filter).populate("userId", "name");
  if (!clash) return;

  throw new AppError(
    `${clash.userId?.name || "Someone"} already leads this unit over that period. A unit has one lead at a time.`,
    409,
  );
};

// A lead belongs to the unit ABOVE the one they lead, which is what keeps the
// reporting line pointing upward. A lead of Backend who was a member of Backend would
// be their own supervisor, closing the chain into a loop.
//
// ⚠️ THE ROOT IS EXEMPT: the company unit has no parent, so there is no unit its lead
// could belong to. The consequence is deliberate rather than merely tolerated, because
// someone at the top who belongs to no unit has no supervisor and is not appraised,
// which is what the design already says about leadership.
const assertLeadSitsInParentUnit = async (unit, userId, from) => {
  if (!unit.parentUnitId) return;

  const membership = await UnitMembership.findOne({
    userId,
    unitId: unit.parentUnitId,
    ...activeOn(from),
  });
  if (membership) return;

  const parent = await OrgUnit.findById(unit.parentUnitId).select("name");
  throw new AppError(
    `A unit's lead must belong to the unit above it. This person was not in ${
      parent?.name || "the parent unit"
    } on ${from.toISOString().slice(0, 10)}.`,
    409,
  );
};

// Reading


exports.listLeads = async ({ unitId, userId, on } = {}) => {
  const filter = {};
  if (unitId) filter.unitId = unitId;
  if (userId) filter.userId = userId;
  if (on) Object.assign(filter, activeOn(toDay(on, "on")));

  const items = await UnitLead.find(filter)
    .sort({ from: -1 })
    .populate("userId", "name employeeId")
    .populate("unitId", "name type");

  return { items, total: items.length };
};

exports.getLeadById = async (id) => {
  const record = await UnitLead.findById(id);
  if (!record) throw new AppError("Leadership record not found", 404);
  return record;
};

// Who led this unit on this date, or null when nobody did, which is a real answer the
// reporting line handles by looking at the parent unit. `select` is explicit rather
// than open: a bare populate would carry the whole user document into a response.
exports.leadOn = async (unitId, date) =>
  UnitLead.findOne({ unitId, ...activeOn(toDay(date, "date")) }).populate(
    "userId",
    "name employeeId designation",
  );

// Writing

// If the unit already has a lead, that record is CLOSED on the same date rather than
// overwritten, so past appraisals keep pointing at whoever ran the unit then.
//
// This differs from memberships on purpose: a second open membership is refused
// because a person in two units is an error, while a second lead is an implied
// handover.
exports.appointLead = async ({ unitId, userId, from }) => {
  await assertUserExists(userId);
  const unit = await assertUnitExists(unitId);

  const start = toDay(from, "from");
  await assertLeadSitsInParentUnit(unit, userId, start);

  const open = await UnitLead.findOne({ unitId, to: null });

  if (open) {
    if (String(open.userId) === String(userId)) {
      throw new AppError("This person already leads this unit", 409);
    }
    if (start.getTime() <= open.from.getTime()) {
      throw new AppError(
        `The handover date must be after ${open.from
          .toISOString()
          .slice(0, 10)}, when the current lead took over`,
        400,
      );
    }
    open.to = start;
    await open.save();
  }

  // Still checked after the handover above: it catches an appointment backdated
  // across a CLOSED leadership record, which closing the open one does not.
  await assertUnitHasNoOtherLead(unitId, start, null);

  return UnitLead.create({ unitId, userId, from: start, to: null });
};

// A unit left with no lead, allowed on purpose: the reporting line resolves upward to
// the parent's lead, so nobody is left unsupervised while the post is vacant.
exports.closeLead = async (id, to) => {
  const record = await exports.getLeadById(id);
  if (record.to) {
    throw new AppError("This leadership record has already ended", 409);
  }

  const end = toDay(to, "to");
  assertOrderedRange(record.from, end);

  record.to = end;
  await record.save();
  return record;
};
