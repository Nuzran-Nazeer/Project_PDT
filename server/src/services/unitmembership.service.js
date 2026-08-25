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

// Placing people in units, with dates. Nothing here is ever overwritten -- a move
// closes one record and opens another, which is the whole reason this collection
// exists instead of a `unitId` field on the user.
//
// The cost, stated plainly and for the same reason it is stated in the unit tree
// service: a write that bypasses this file bypasses every rule below. The seed
// script must call these functions, not UnitMembership.create().

// ---------------------------------------------------------------------------
// Existence
// ---------------------------------------------------------------------------
// Both are checked before anything is written. A membership pointing at a unit that
// was never created is not a broken query later -- it is silently wrong data, and
// the appraisal built on it looks perfectly normal.
const assertUserExists = async (userId) => {
  const user = await User.findById(userId).select("_id name status");
  if (!user) throw new AppError("Employee not found", 404);
  return user;
};

const assertUnitExists = async (unitId) => {
  const unit = await OrgUnit.findById(unitId).select("_id name");
  if (!unit) throw new AppError("Unit not found", 404);
  return unit;
};

// ---------------------------------------------------------------------------
// One unit at a time
// ---------------------------------------------------------------------------
// The story asks only that a SECOND membership be refused while one is still open.
// This checks something slightly stronger -- that no two of a person's memberships
// overlap at all, open or closed -- and the stronger rule is the one that makes the
// story's other criterion answerable.
//
// "Which unit was she in on 12 March" has to have ONE answer. If two closed records
// could overlap, backfilling history would quietly produce two, and every rule
// downstream (peer pool, supervisor, HR coverage) would then depend on which one
// the database happened to return first.
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

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------
// One read shape only, and `on` is what answers "which unit was she in then".
//
// Three narrower helpers were cut from here before committing the last story. TWO
// ARE RESTORED BELOW, because the reporting line calls them. `membersOn` -- everyone
// in a unit on a date -- stays cut: no criterion in the reporting-line story reaches
// it either, and it is still sitting verbatim in PDT-BUILD-LOG.md for whichever
// story finally needs a roster.
exports.listMemberships = async ({ userId, unitId, on } = {}) => {
  const filter = {};
  if (userId) filter.userId = userId;
  if (unitId) filter.unitId = unitId;
  if (on) Object.assign(filter, activeOn(toDay(on, "on")));

  // Newest first: the current record is the one anyone opening a person's history
  // is looking for, and it should not be at the bottom of ten years of stints.
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

// THE query the rest of the system depends on: which unit did this person belong to
// on this date. Returns null for someone who belonged to no unit then -- which is a
// real answer, not a missing one. Someone with no unit has no supervisor and is not
// appraised, so callers must handle null rather than treat it as an error.
//
// Safe to call with a Date that is already normalised: toDay re-normalising an
// existing UTC midnight returns the same instant.
exports.membershipOn = async (userId, date) =>
  UnitMembership.findOne({ userId, ...activeOn(toDay(date, "date")) });

exports.unitIdOn = async (userId, date) => {
  const membership = await exports.membershipOn(userId, date);
  return membership ? membership.unitId : null;
};

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

// Open a membership. `to` is optional and exists for backfilling history that is
// already over -- a stint someone finished before the system was switched on.
exports.createMembership = async ({ userId, unitId, from, to }) => {
  await assertUserExists(userId);
  await assertUnitExists(unitId);

  const start = toDay(from, "from");
  const end = to ? toDay(to, "to") : null;
  assertOrderedRange(start, end);

  await assertNoOverlap(userId, start, end);

  return UnitMembership.create({ userId, unitId, from: start, to: end });
};

// Moving someone: close the open membership on the date they leave and open the new
// one on the same date. ONE call, because two calls can half-succeed -- and a person
// left with no membership at all, or with two, is worse than either operation being
// refused outright.
//
// The two records share the date exactly. Under the [from, to) convention that means
// no gap and no overlap: 31 March resolves to the old unit, 1 April to the new one.
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

  // A move dated on or before the day the current stint began would leave a record
  // covering no days at all.
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

// Ending a membership without opening another -- someone leaving the company, or a
// unit closing around them. They then belong to no unit, have no supervisor, and are
// not appraised, which is a state the design allows for on purpose.
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
