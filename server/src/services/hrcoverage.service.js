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

// Who in HR is responsible for a unit's people. Separate from UnitLead on purpose: a
// lead is the reporting line.

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

// Only `assignCoverage` calls this: closing a record inside a discontinued unit must still
// work, because the discontinue cascade relies on it.
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

// Scoped to unit and role: a primary and a backup are both real coverage at once.
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

// Checks overlap, not "ever held the other role": two non-overlapping stints are history.
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

// Two queries however deep the tree, so a list resolving every unit does not climb per unit.
exports.loadCoverageOn = async (date) => {
  const day = toDay(date, "on");
  const [units, records] = await Promise.all([
    OrgUnit.find().select("name type parentUnitId"),
    HrCoverage.find(activeOn(day)).populate("userId", "name employeeId"),
  ]);

  const recordsByUnit = new Map();
  for (const record of records) {
    const key = String(record.unitId);
    if (!recordsByUnit.has(key)) recordsByUnit.set(key, []);
    recordsByUnit.get(key).push(record);
  }

  return { units: new Map(units.map((u) => [String(u._id), u])), recordsByUnit };
};

// Climbs upward from `unitId`, and each role stops separately at the nearest unit with an
// open direct record for it (B31): a direct backup never hides an inherited primary.
exports.resolveCoverage = ({ units, recordsByUnit }, unitId) => {
  // A map lookup cannot reject a malformed id the way findById did.
  if (!mongoose.isValidObjectId(unitId)) throw new AppError("Invalid _id", 400);
  const requestedUnit = units.get(String(unitId));
  if (!requestedUnit) throw new AppError("Unit not found", 404);

  const found = { primary: null, backup: null };
  const seen = new Set();
  let cursorUnit = requestedUnit;

  while (cursorUnit && !(found.primary && found.backup)) {
    const cursorId = String(cursorUnit._id);
    if (seen.has(cursorId)) {
      throw new AppError("The unit tree above this unit contains a loop", 409);
    }
    seen.add(cursorId);

    const records = recordsByUnit.get(cursorId) || [];

    for (const role of ["primary", "backup"]) {
      const record = records.find((r) => r.role === role);
      if (!found[role] && record) found[role] = { record, unit: cursorUnit };
    }

    cursorUnit = cursorUnit.parentUnitId
      ? units.get(String(cursorUnit.parentUnitId))
      : null;
  }

  const resolvedFor = (role) =>
    found[role]
      ? {
          unit: asUnit(found[role].unit),
          upward: String(found[role].unit._id) !== String(unitId),
        }
      : null;

  return {
    requestedUnit: asUnit(requestedUnit),
    primary: found.primary ? asHolder(found.primary.record) : null,
    backup: found.backup ? asHolder(found.backup.record) : null,
    resolved: { primary: resolvedFor("primary"), backup: resolvedFor("backup") },
  };
};

exports.coverageOn = async (unitId, date) =>
  exports.resolveCoverage(await exports.loadCoverageOn(date), unitId);

// One transaction, or a half-succeeded handover leaves no primary or two. Atlas is always
// a replica set, so transactions are available.
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

// An open record for the same role is closed on the handover date, never overwritten.
// The other role's record is untouched.
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

  // `open` is excluded because closing it below is what makes way for this assignment.
  await assertNoOtherHolderForRole(unitId, role, start, null, open?._id);
  await assertNotBothRoles(unitId, userId, role, start, null);

  return closeAndCreate({ open, unitId, userId, role, from: start });
};

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
