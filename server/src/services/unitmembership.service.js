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

// Placing people in units, with dates. Nothing is ever overwritten: a move closes one
// record and opens another, which is why this collection exists instead of a `unitId`
// field on the user.
//
// ⚠️ A write that bypasses this file bypasses every rule below. The seed script must
// call these functions, never UnitMembership.create().

// Checked before anything is written: a membership pointing at a unit that never
// existed is silently wrong data, and the appraisal built on it looks normal.
const assertUserExists = async (userId) => {
  const user = await User.findById(userId).select("_id name status");
  if (!user) throw new AppError("Employee not found", 404);
  return user;
};

// Also refuses a DISCONTINUED unit as a destination. Only the write paths call it, so
// closing a membership inside one still works, or a mistake could never be unwound.
const assertUnitExists = async (unitId) => {
  const unit = await OrgUnit.findById(unitId).select("_id name active");
  if (!unit) throw new AppError("Unit not found", 404);
  if (!unit.active) {
    throw new AppError(
      `${unit.name} has been discontinued, so nobody can be placed in it`,
      409,
    );
  }
  return unit;
};

// ⚠️ Refuses ANY overlap, open or closed. "Which unit was she in on 12 March" has to
// have one answer; two overlapping closed records would make every rule downstream
// depend on which one the database returned first.
const assertNoOverlap = async (userId, from, to, excludeId) => {
  const filter = { userId, ...overlapping(from, to) };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await UnitMembership.findOne(filter).populate("unitId", "name");
  if (!clash) return;

  const unitName = clash.unitId?.name || "another unit";
  const ends = clash.to
    ? ` until ${clash.to.toISOString().slice(0, 10)}`
    : ", still open";
  throw new AppError(
    `This person is already in ${unitName} from ${clash.from
      .toISOString()
      .slice(0, 10)}${ends}. Close that membership before opening another.`,
    409,
  );
};

// One read shape only; `on` answers "which unit was she in then".
exports.listMemberships = async ({ userId, unitId, on } = {}) => {
  const filter = {};
  if (userId) filter.userId = userId;
  if (unitId) filter.unitId = unitId;
  if (on) Object.assign(filter, activeOn(toDay(on, "on")));

  // Newest first: the current record should not sit under ten years of stints.
  const items = await UnitMembership.find(filter)
    .sort({ from: -1 })
    .populate("userId", "name employeeId")
    .populate("unitId", "name type");

  return { items, total: items.length };
};

exports.getMembershipById = async (id) => {
  const membership = await UnitMembership.findById(id);
  if (!membership) throw new AppError("Membership not found", 404);
  return membership;
};

// THE query the rest of the system depends on. Null is a real answer, not a missing
// one: someone with no unit has no supervisor and is not appraised.
//
// Safe to call with an already-normalised Date: toDay is idempotent.
exports.membershipOn = async (userId, date) =>
  UnitMembership.findOne({ userId, ...activeOn(toDay(date, "date")) });

exports.unitIdOn = async (userId, date) => {
  const membership = await exports.membershipOn(userId, date);
  return membership ? membership.unitId : null;
};

// Writing

// `to` is optional, for backfilling a stint that was already over.
exports.createMembership = async ({ userId, unitId, from, to }) => {
  await assertUserExists(userId);
  await assertUnitExists(unitId);

  const start = toDay(from, "from");
  const end = to ? toDay(to, "to") : null;
  assertOrderedRange(start, end);

  await assertNoOverlap(userId, start, end);

  return UnitMembership.create({ userId, unitId, from: start, to: end });
};

// ⚠️ ONE call, because two can half-succeed and leave a person in no unit or in two.
//
// The two records share the date exactly, which under [from, to) means no gap and no
// overlap: 31 March resolves to the old unit, 1 April to the new one.
exports.transferMembership = async ({ userId, unitId, from }) => {
  await assertUserExists(userId);
  const unit = await assertUnitExists(unitId);

  const moveDate = toDay(from, "from");

  const open = await UnitMembership.findOne({ userId, to: null });
  if (!open) {
    throw new AppError(
      "This person is not in a unit, so there is nothing to move them from. Open a membership instead.",
      409,
    );
  }

  if (String(open.unitId) === String(unitId)) {
    throw new AppError(`This person is already in ${unit.name}`, 409);
  }

  // A move on or before the current stint's start leaves a record covering no days.
  if (moveDate.getTime() <= open.from.getTime()) {
    throw new AppError(
      `The move date must be after ${open.from
        .toISOString()
        .slice(0, 10)}, when the current membership began`,
      400,
    );
  }

  open.to = moveDate;
  await open.save();

  return UnitMembership.create({ userId, unitId, from: moveDate, to: null });
};

// Ending without opening another. They then belong to no unit and are not appraised,
// which is a state the design allows for.
exports.closeMembership = async (id, to) => {
  const membership = await exports.getMembershipById(id);
  if (membership.to) {
    throw new AppError("This membership has already ended", 409);
  }

  const end = toDay(to, "to");
  assertOrderedRange(membership.from, end);

  membership.to = end;
  await membership.save();
  return membership;
};
