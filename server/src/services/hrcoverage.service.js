const mongoose = require("mongoose");
const HrCoverage = require("../models/hrcoverage.model");
const OrgUnit = require("../models/orgunit.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { HR_COVERAGE_ROLES, HR_OFFICER_ROLES } = require("../config/constants");
const {
  toDay,
  assertOrderedRange,
  activeOn,
  overlapping,
} = require("../utils/dateRange");

// Who covers a unit for HR purposes, and (unless overridden) its sub-units.
// Separate from UnitLead on purpose: a lead is the reporting line, an HR officer's
// coverage is who in HR is responsible for the people in a unit. Two different
// questions that happen to share a shape.

// ⚠️ Enforced here, not only in the client's candidate picker: a request built by hand
// must be refused the same way a form ever could be.
const assertUserIsAssignableHrOfficer = async (userId) => {
  const user = await User.findById(userId).select("_id name status roles");
  if (!user) throw new AppError("Employee not found", 404);

  if (user.status !== "active") {
    throw new AppError(
      `${user.name} is not active, so they cannot be assigned as an HR officer`,
      409,
    );
  }

  const holdsHrRole = (user.roles || []).some((role) => HR_OFFICER_ROLES.includes(role));
  if (!holdsHrRole) {
    throw new AppError(
      `${user.name} does not hold the hr or head_of_hr role, so they cannot be assigned as an HR officer`,
      409,
    );
  }

  return user;
};

// Goes beyond what the design states, the same way unitlead's assertUnitExists does:
// covering a unit that no longer operates would undo what discontinuing just did. Only
// `assignCoverage` calls this, so closing a record inside a discontinued unit still
// works (the cascade in orgunit.service.js relies on that).
const assertUnitExists = async (unitId) => {
  const unit = await OrgUnit.findById(unitId).select("_id name parentUnitId active");
  if (!unit) throw new AppError("Unit not found", 404);
  if (!unit.active) {
    throw new AppError(
      `${unit.name} has been discontinued, so it cannot be given HR coverage`,
      409,
    );
  }
  return unit;
};

// A unit has at most one PRIMARY and one BACKUP on any date. Scoped to unit+role, not
// to the unit alone: a primary and a backup are both real coverage at once, unlike a
// unit lead's single slot.
const assertNoOtherHolderForRole = async (unitId, role, from, to, excludeId) => {
  const filter = { unitId, role, ...overlapping(from, to) };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await HrCoverage.findOne(filter).populate("userId", "name");
  if (!clash) return;

  throw new AppError(
    `${clash.userId?.name || "Someone"} already covers this unit as ${role} over that period. A unit has one ${role} at a time.`,
    409,
  );
};

// One person cannot be both officers on the same unit AT ONCE. Date-aware: two
// non-overlapping stints (primary last year, backup this year) are ordinary history,
// not a clash, so this checks OVERLAP, not "ever held the other role".
const assertNotBothRoles = async (unitId, userId, role, from, to) => {
  const otherRole = role === "primary" ? "backup" : "primary";
  const clash = await HrCoverage.findOne({
    unitId,
    userId,
    role: otherRole,
    ...overlapping(from, to),
  });
  if (!clash) return;

  throw new AppError(
    `This person already covers this unit as ${otherRole} over that period. One person cannot be both officers on the same unit at once.`,
    409,
  );
};

// Reading

exports.listCoverage = async ({ unitId, userId, role, on } = {}) => {
  const filter = {};
  if (unitId) filter.unitId = unitId;
  if (userId) filter.userId = userId;
  if (role) filter.role = role;
  if (on) Object.assign(filter, activeOn(toDay(on, "on")));

  const items = await HrCoverage.find(filter)
    .sort({ from: -1 })
    .populate("userId", "name employeeId")
    .populate("unitId", "name type");

  return { items, total: items.length };
};

exports.getCoverageById = async (id) => {
  const record = await HrCoverage.findById(id);
  if (!record) throw new AppError("Coverage record not found", 404);
  return record;
};

const asPerson = (user) =>
  user ? { id: user._id, name: user.name, employeeId: user.employeeId } : null;

const asUnit = (unit) =>
  unit ? { id: unit._id, name: unit.name, type: unit.type } : null;

const asHolder = (record) =>
  record
    ? { ...asPerson(record.userId), coverageId: record._id, from: record.from }
    : null;

// THE resolver. Climbs from `unitId` upward (itself first) and stops at the nearest
// unit -- including the one asked about -- that has ANY open direct record on `date`.
// That unit's own direct records answer BOTH roles from there: a sub-unit with a
// direct primary but no direct backup shows backup as VACANT, not inherited, because
// the walk has already stopped and does not resume per role. The reverse holds too.
// Nothing falls further up the tree once a unit has stepped in for itself.
//
// Mirrors climbToLead in supervision.service.js; must stay the same shape so the two
// features cannot drift into two different ideas of "how coverage travels down the
// tree".
exports.coverageOn = async (unitId, date) => {
  const day = toDay(date, "on");
  const requestedUnit = await OrgUnit.findById(unitId).select("name type parentUnitId");
  if (!requestedUnit) throw new AppError("Unit not found", 404);

  const seen = new Set();
  let cursorId = String(unitId);
  let cursorUnit = requestedUnit;

  while (cursorUnit) {
    if (seen.has(cursorId)) {
      throw new AppError("The unit tree above this unit contains a loop", 409);
    }
    seen.add(cursorId);

    const records = await HrCoverage.find({
      unitId: cursorId,
      ...activeOn(day),
    }).populate("userId", "name employeeId");

    if (records.length) {
      return {
        requestedUnit: asUnit(requestedUnit),
        resolvedUnit: asUnit(cursorUnit),
        primary: asHolder(records.find((r) => r.role === "primary")),
        backup: asHolder(records.find((r) => r.role === "backup")),
        resolvedUpward: cursorId !== String(unitId),
      };
    }

    if (!cursorUnit.parentUnitId) break;
    cursorUnit = await OrgUnit.findById(cursorUnit.parentUnitId).select(
      "name type parentUnitId",
    );
    cursorId = cursorUnit ? String(cursorUnit._id) : null;
  }

  // Ran out of tree with nobody covering any unit along the way: both roles vacant.
  return {
    requestedUnit: asUnit(requestedUnit),
    resolvedUnit: null,
    primary: null,
    backup: null,
    resolvedUpward: false,
  };
};

// Writing

// Closing the old record and creating the replacement happen in one transaction: a
// half-succeeded handover would otherwise leave a unit with either no primary (if the
// close commits but the create fails) or two open primaries racing the unique index
// (if the create commits but the close never ran). MongoDB Atlas is the one
// deployment this project runs against (see README), and Atlas is always a replica
// set, so transactions are available here unlike in most of this codebase's other
// multi-write paths.
const closeAndCreate = async ({ open, unitId, userId, role, from }) => {
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      if (open) {
        open.to = from;
        await open.save({ session });
      }
      const [doc] = await HrCoverage.create([{ unitId, userId, role, from, to: null }], {
        session,
      });
      created = doc;
    });
    return created;
  } finally {
    await session.endSession();
  }
};

// If the unit already has an open record for this ROLE, it is CLOSED on the same date
// rather than overwritten, so a past appraisal decision (who was responsible for this
// unit then) keeps pointing at whoever actually covered it. The other role's open
// record, if any, is untouched -- a new primary does not disturb the backup.
exports.assignCoverage = async ({ unitId, userId, role, from }) => {
  if (!HR_COVERAGE_ROLES.includes(role)) {
    throw new AppError(`role must be one of: ${HR_COVERAGE_ROLES.join(", ")}`, 400);
  }

  await assertUserIsAssignableHrOfficer(userId);
  await assertUnitExists(unitId);

  const start = toDay(from, "from");

  const open = await HrCoverage.findOne({ unitId, role, to: null });

  if (open) {
    if (String(open.userId) === String(userId)) {
      throw new AppError(`This person already covers this unit as ${role}`, 409);
    }
    if (start.getTime() <= open.from.getTime()) {
      throw new AppError(
        `The handover date must be after ${open.from
          .toISOString()
          .slice(0, 10)}, when the current ${role} took over`,
        400,
      );
    }
  }

  // Checked as if the handover had already happened, catching a start date that would
  // clash with a CLOSED record too (backdating across a past term). `open` is excluded
  // because closing it, below, is what makes way for this assignment.
  await assertNoOtherHolderForRole(unitId, role, start, null, open?._id);
  await assertNotBothRoles(unitId, userId, role, start, null);

  return closeAndCreate({ open, unitId, userId, role, from: start });
};

// Ending without a replacement. The role is then vacant on this unit, which the
// resolver handles by climbing to the parent -- the same vacancy story a unit lead's
// closed term tells.
exports.closeCoverage = async (id, to) => {
  const record = await exports.getCoverageById(id);
  if (record.to) {
    throw new AppError("This coverage record has already ended", 409);
  }

  const end = toDay(to, "to");
  assertOrderedRange(record.from, end);

  record.to = end;
  await record.save();
  return record;
};
