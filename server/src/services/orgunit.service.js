const OrgUnit = require("../models/orgunit.model");
const UnitMembership = require("../models/unitmembership.model");
const UnitLead = require("../models/unitlead.model");
const AppError = require("../utils/AppError");
const { toDay, dayAfter, overlapping } = require("../utils/dateRange");

// The invariants live here, not on the model, because each is a rule about OTHER
// documents and a model validator sees only the one being saved.
//
// ⚠️ A write that bypasses this service bypasses every invariant. The seed script must
// call createUnit(), never OrgUnit.create().

const CREATABLE_FIELDS = ["name", "type", "parentUnitId"];

// `active` is absent on purpose: closing a unit is a considered operation with three
// checks in front of it, not a field anybody may flip on an ordinary edit.
const UPDATABLE_FIELDS = ["name", "type", "parentUnitId"];

const pick = (source, fields) =>
  fields.reduce((out, key) => {
    if (source[key] !== undefined) out[key] = source[key];
    return out;
  }, {});

// Invariant 1: exactly one unit has no parent. Two roots means two disconnected
// trees, and "who is my supervisor" stops having one answer.
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

// Invariant 2: a unit may not be its own ancestor. Walk up from the PROPOSED parent;
// a loop makes every later walk up the tree non-terminating. Doubles as the
// parent-exists check.
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

    // A looped tree would otherwise spin here forever.
    if (seen.has(step)) {
      throw new AppError("The unit tree above this unit contains a loop", 409);
    }
    seen.add(step);

    const parent = await OrgUnit.findById(step).select("parentUnitId");
    if (!parent) throw new AppError("Parent unit not found", 404);

    cursor = parent.parentUnitId;
  }
};

// Invariant 3: only the top unit may be a "company". NOT a depth rule: nothing checks
// that a sub-unit sits under a unit, because three type names cannot label the five
// levels the tree is expected to reach. The reverse is not enforced either.
const assertCompanyIsRoot = (type, parentUnitId) => {
  if (type === "company" && parentUnitId) {
    throw new AppError(
      "Only the unit at the top of the tree can be a company. Give this one a different type.",
      400,
    );
  }
};

// Invariant 4: siblings may not share a name. Scoped to SIBLINGS, not the collection:
// "Backend" under Engineering and under Data are different real things.
// Invariant 5: nothing new may be hung on a discontinued unit. Checked on the
// PROPOSED parent only, so moving a unit OUT of one stays allowed.
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
    // Case-insensitive: "Backend" and "backend" are the same unit to a reader.
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

// Flat: each unit carries its parent, so a caller assembles the tree in one pass. A
// nested response would have to decide what to do with an orphan.
exports.listUnits = async () => {
  const items = await OrgUnit.find().sort({ name: 1 });
  return { items, total: items.length };
};

exports.getUnitById = async (id) => {
  const unit = await OrgUnit.findById(id);
  if (!unit) throw new AppError("Unit not found", 404);
  return unit;
};

// Load, assign, save, so a document hook added later fires here too.
exports.updateUnit = async (id, data) => {
  const unit = await OrgUnit.findById(id);
  if (!unit) throw new AppError("Unit not found", 404);

  const fields = pick(data, UPDATABLE_FIELDS);

  // ⚠️ Every check below judges the RESULT, not what was sent, so a request changing
  // one field is still judged against the fields it did not change.
  const nextType = "type" in fields ? fields.type : unit.type;
  const nextName = "name" in fields ? fields.name : unit.name;
  const nextParent =
    "parentUnitId" in fields ? fields.parentUnitId || null : unit.parentUnitId;

  assertCompanyIsRoot(nextType, nextParent);

  // A rename must not pay for a walk to the root, nor fail because of one.
  const parentChanged = String(nextParent) !== String(unit.parentUnitId);
  if (parentChanged) {
    if (nextParent) {
      await assertParentIsUsable(unit._id, nextParent);
      await assertParentIsLive(nextParent);
    } else {
      // Detaching would make a second root.
      await assertNoOtherRoot(unit._id);
    }
  }

  // Runs when EITHER half changes: a move can collide with a name that was fine
  // where the unit was before.
  const nameChanged = String(nextName).trim() !== String(unit.name).trim();
  if (parentChanged || nameChanged) {
    await assertNameFreeAmongSiblings(nextName, nextParent, unit._id);
  }

  Object.assign(unit, fields);
  await unit.save();
  return unit;
};

// The unit is marked closed, never deleted: past appraisals were run inside it.
//
// ⚠️ THIS REFUSES RATHER THAN CASCADING. Quietly closing the memberships would drop
// everyone out of the appraisal cycle with no error and nothing visible on any screen,
// because a person with no unit is not appraised. The leadership record IS closed
// automatically, which is safe because a lead belongs to the unit above.
exports.discontinueUnit = async (id, lastDay) => {
  const unit = await OrgUnit.findById(id);
  if (!unit) throw new AppError("Unit not found", 404);
  if (!unit.active) {
    throw new AppError(`${unit.name} has already been discontinued`, 409);
  }

  // ⚠️ `assertNoOtherRoot` does not filter on `active`, so a discontinued root would
  // still occupy the one root slot and no replacement could ever be created.
  if (!unit.parentUnitId) {
    throw new AppError(
      `${unit.name} is the top of the tree and cannot be discontinued`,
      409,
    );
  }

  const finalDay = toDay(lastDay, "lastDay");
  const closesOn = dayAfter(finalDay);

  // Checked before members: the cheaper query and the more common mistake.
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

  // `overlapping(closesOn, null)` catches anyone still in the unit on the closing day
  // AND anyone whose membership starts after it, which a plain as-at check would miss
  // on a backfilled record.
  const members = await UnitMembership.find({
    unitId: unit._id,
    ...overlapping(closesOn, null),
  }).populate("userId", "name");

  if (members.length) {
    const names = members
      .map((m) => (m.userId && m.userId.name) || "someone")
      .join(", ");
    throw new AppError(
      `${unit.name} still has ${members.length === 1 ? "a member" : "members"}: ${names}. Move ${members.length === 1 ? "them" : "them all"} to another unit first, or they will be left with no supervisor and no appraisal.`,
      409,
    );
  }

  // Before the unit is marked inactive, so a bad date fails with nothing written.
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

  // ⚠️ The LAST day it operated, not `closesOn`, which is the storage form. This field
  // is read back by HR, so it holds what HR typed.
  unit.active = false;
  unit.discontinuedOn = finalDay;
  await unit.save();
  return unit;
};
