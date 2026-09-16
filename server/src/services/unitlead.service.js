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

// This file only records; "who supervises whom" belongs to supervision.service.js.

const assertUserExists = async (userId) => {
  const user = await User.findById(userId).select("_id name");
  if (!user) throw new AppError("Employee not found", 404);
  return user;
};

// Only `appointLead` calls this, so closing a term inside a discontinued unit still works.
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

// Scoped to the unit, not the person: one person may lead two units at once.
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

// A lead belongs to the unit above the one they lead, or they would be their own
// supervisor. The root is exempt: it has no parent.
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

// Null when nobody did. `select` is explicit: a bare populate would serve the whole user.
exports.leadOn = async (unitId, date) =>
  UnitLead.findOne({ unitId, ...activeOn(toDay(date, "date")) }).populate(
    "userId",
    "name employeeId designation",
  );

// An existing lead's record is closed on the same date, never overwritten: a second lead
// is an implied handover, unlike a second membership.
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

  // Still needed after the handover: it catches backdating across a closed record.
  await assertUnitHasNoOtherLead(unitId, start, null);

  return UnitLead.create({ unitId, userId, from: start, to: null });
};

// A unit may be left with no lead: the reporting line resolves upward.
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
