const OrgUnit = require("../models/orgunit.model");
const UnitMembership = require("../models/unitmembership.model");
const UnitLead = require("../models/unitlead.model");
const HrCoverage = require("../models/hrcoverage.model");
const AppError = require("../utils/AppError");
const { toDay, dayAfter, overlapping } = require("../utils/dateRange");

// ⚠️ A write that bypasses this service bypasses every invariant. The seed script must
// call createUnit(), never OrgUnit.create().

const CREATABLE_FIELDS = ["name", "type", "parentUnitId"];

// `active` is absent on purpose: closing a unit goes through discontinueUnit.
const UPDATABLE_FIELDS = ["name", "type", "parentUnitId"];

const pick = (source, fields) =>
  fields.reduce((out, key) => {
    if (source[key] !== undefined) out[key] = source[key];
    return out;
  }, {});

// Exactly one unit has no parent.
const assertNoOtherRoot = async (excludeId) => {
  const filter = { parentUnitId: null };
  if (excludeId) filter._id = { $ne: excludeId };

  const root = await OrgUnit.findOne(filter);
  if (root) {
    throw new AppError(
      `${root.name} is already the top of the tree, and there can only be one. Give this unit a parent.`,
      409,
    );
  }
};

// A unit may not be its own ancestor. Doubles as the parent-exists check.
const assertParentIsUsable = async (unitId, parentUnitId) => {
  const movingUnit = unitId ? String(unitId) : null;
  const seen = new Set();
  let cursor = parentUnitId;

  while (cursor) {
    const step = String(cursor);

    if (movingUnit && step === movingUnit) {
      throw new AppError(
        "A unit cannot sit inside itself, or inside one of its own sub-units",
        400,
      );
    }

    if (seen.has(step)) {
      throw new AppError("The unit tree above this unit contains a loop", 409);
    }
    seen.add(step);

    const parent = await OrgUnit.findById(step).select("parentUnitId");
    if (!parent) throw new AppError("Parent unit not found", 404);

    cursor = parent.parentUnitId;
  }
};

// Not a depth rule: three type names cannot label the five levels the tree can reach.
const assertCompanyIsRoot = (type, parentUnitId) => {
  if (type === "company" && parentUnitId) {
    throw new AppError(
      "Only the unit at the top of the tree can be a company. Give this one a different type.",
      400,
    );
  }
};

// Checked on the proposed parent only, so moving a unit out of a discontinued one stays allowed.
const assertParentIsLive = async (parentUnitId) => {
  if (!parentUnitId) return;

  const parent = await OrgUnit.findById(parentUnitId).select("name active");
  if (parent && !parent.active) {
    throw new AppError(
      `${parent.name} has been discontinued, so nothing new can be placed inside it`,
      409,
    );
  }
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertNameFreeAmongSiblings = async (name, parentUnitId, excludeId) => {
  const filter = {
    parentUnitId: parentUnitId || null,
    name: new RegExp(`^${escapeRegex(String(name).trim())}$`, "i"),
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await OrgUnit.findOne(filter);
  if (clash) {
    throw new AppError(
      `There is already a unit called ${clash.name} in the same place. Two units under one parent cannot share a name.`,
      409,
    );
  }
};

exports.createUnit = async (data) => {
  const fields = pick(data, CREATABLE_FIELDS);
  if (!fields.parentUnitId) fields.parentUnitId = null;

  assertCompanyIsRoot(fields.type, fields.parentUnitId);

  if (fields.parentUnitId) {
    await assertParentIsUsable(null, fields.parentUnitId);
    await assertParentIsLive(fields.parentUnitId);
  } else {
    await assertNoOtherRoot();
  }

  await assertNameFreeAmongSiblings(fields.name, fields.parentUnitId);

  return OrgUnit.create(fields);
};

exports.listUnits = async () => {
  const items = await OrgUnit.find().sort({ name: 1 });
  return { items, total: items.length };
};

exports.getUnitById = async (id) => {
  const unit = await OrgUnit.findById(id);
  if (!unit) throw new AppError("Unit not found", 404);
  return unit;
};

exports.updateUnit = async (id, data) => {
  const unit = await OrgUnit.findById(id);
  if (!unit) throw new AppError("Unit not found", 404);

  const fields = pick(data, UPDATABLE_FIELDS);

  // Every check below judges the result, not what was sent.
  const nextType = "type" in fields ? fields.type : unit.type;
  const nextName = "name" in fields ? fields.name : unit.name;
  const nextParent =
    "parentUnitId" in fields ? fields.parentUnitId || null : unit.parentUnitId;

  assertCompanyIsRoot(nextType, nextParent);

  const parentChanged = String(nextParent) !== String(unit.parentUnitId);
  if (parentChanged) {
    if (nextParent) {
      await assertParentIsUsable(unit._id, nextParent);
      await assertParentIsLive(nextParent);
    } else {
      await assertNoOtherRoot(unit._id);
    }
  }

  // A move can collide with a name that was fine where the unit was before.
  const nameChanged = String(nextName).trim() !== String(unit.name).trim();
  if (parentChanged || nameChanged) {
    await assertNameFreeAmongSiblings(nextName, nextParent, unit._id);
  }

  Object.assign(unit, fields);
  await unit.save();
  return unit;
};

// ⚠️ Refuses while members remain rather than cascading: closing memberships would drop
// everyone out of the appraisal cycle silently. Lead and coverage records are closed,
// because both resolve to the unit above on their own.
exports.discontinueUnit = async (id, lastDay) => {
  const unit = await OrgUnit.findById(id);
  if (!unit) throw new AppError("Unit not found", 404);
  if (!unit.active) {
    throw new AppError(`${unit.name} has already been discontinued`, 409);
  }

  // A discontinued root would still occupy the one root slot.
  if (!unit.parentUnitId) {
    throw new AppError(
      `${unit.name} is the top of the tree and cannot be discontinued`,
      409,
    );
  }

  const finalDay = toDay(lastDay, "lastDay");
  const closesOn = dayAfter(finalDay);

  const children = await OrgUnit.find({
    parentUnitId: unit._id,
    active: true,
  }).select("name");

  if (children.length) {
    const names = children.map((c) => c.name).join(", ");
    throw new AppError(
      `${unit.name} still has ${children.length === 1 ? "a sub-unit" : "sub-units"} beneath it: ${names}. Discontinue those first, from the bottom of the tree upward.`,
      409,
    );
  }

  // `overlapping` also catches a backfilled membership starting after the closing day.
  const members = await UnitMembership.find({
    unitId: unit._id,
    ...overlapping(closesOn, null),
  }).populate("userId", "name");

  if (members.length) {
    const names = members.map((m) => (m.userId && m.userId.name) || "someone").join(", ");
    throw new AppError(
      `${unit.name} still has ${members.length === 1 ? "a member" : "members"}: ${names}. Move ${members.length === 1 ? "them" : "them all"} to another unit first, or they will be left with no supervisor and no appraisal.`,
      409,
    );
  }

  const term = await UnitLead.findOne({ unitId: unit._id, to: null });
  if (term) {
    if (closesOn.getTime() <= term.from.getTime()) {
      throw new AppError(
        `This unit's lead only took over on ${term.from
          .toISOString()
          .slice(0, 10)}, so it cannot have closed before then`,
        400,
      );
    }
    term.to = closesOn;
    await term.save();
  }

  const coverageRecords = await HrCoverage.find({ unitId: unit._id, to: null });

  // ⚠️ Every date is checked before the first save, or the primary closes and the backup throws.
  for (const record of coverageRecords) {
    if (closesOn.getTime() <= record.from.getTime()) {
      throw new AppError(
        `This unit's ${record.role} only started covering it on ${record.from
          .toISOString()
          .slice(0, 10)}, so it cannot have closed before then`,
        400,
      );
    }
  }

  for (const record of coverageRecords) {
    record.to = closesOn;
    await record.save();
  }

  // The last day it operated, not `closesOn`: this field holds what HR typed.
  unit.active = false;
  unit.discontinuedOn = finalDay;
  await unit.save();
  return unit;
};
