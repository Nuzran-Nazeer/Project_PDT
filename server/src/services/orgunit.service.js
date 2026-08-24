const OrgUnit = require("../models/orgunit.model");
const AppError = require("../utils/AppError");

// Business logic for the unit tree. Knows nothing about Express (no req/res here).
//
// Two invariants hold the tree together, and both live here rather than on the model
// because both are rules about OTHER documents — a model validator can only see the
// document being saved. This follows the same split the user service already uses,
// where "is this email already taken" is a service check for the same reason.
//
// The cost, stated: a write that bypasses this service bypasses the invariants. The
// seed script is the write site that will be tempted to — it must call createUnit(),
// not OrgUnit.create().

// Fields that may be set when a unit is created.
const CREATABLE_FIELDS = ["name", "type", "parentUnitId"];

// Fields that may be changed afterwards. `active` is absent on purpose: closing a
// unit is not specified. See the model.
const UPDATABLE_FIELDS = ["name", "type", "parentUnitId"];

const pick = (source, fields) =>
  fields.reduce((out, key) => {
    if (source[key] !== undefined) out[key] = source[key];
    return out;
  }, {});

// ---------------------------------------------------------------------------
// Invariant 1 — exactly one unit has no parent
// ---------------------------------------------------------------------------
// The first unit created is the company and is allowed to have no parent. Every
// unit after it needs one, or the company becomes two disconnected trees and
// "who is my supervisor" stops having one answer.
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

// ---------------------------------------------------------------------------
// Invariant 2 — a unit may not be its own ancestor
// ---------------------------------------------------------------------------
// Walk up from the PROPOSED parent. If the unit being moved appears anywhere on the
// way to the root, the move would close a loop — Engineering under Backend under
// Engineering — and every walk up the tree afterwards would never terminate.
//
// This cannot fire on create: a unit that does not exist yet cannot be above
// anything. It is an update rule, which is why criterion 3 needs an update route to
// be testable at all.
//
// Doubles as the parent-exists check, since it loads every ancestor on the way up.
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

    // Only reachable if the data is ALREADY looped, which the checks above are
    // meant to prevent. Without it a corrupted tree would spin here forever and
    // hang the request rather than failing.
    if (seen.has(step)) {
      throw new AppError("The unit tree above this unit contains a loop", 409);
    }
    seen.add(step);

    const parent = await OrgUnit.findById(step).select("parentUnitId");
    if (!parent) throw new AppError("Parent unit not found", 404);

    cursor = parent.parentUnitId;
  }
};

// ---------------------------------------------------------------------------
// Invariant 3 — only the unit at the top may be a "company"
// ---------------------------------------------------------------------------
// This is NOT a depth rule. Nothing checks that a sub-unit sits under a unit, and
// deliberately so: the design expects this tree to reach five levels without a
// rewrite, and three type names cannot label five levels — enforcing type-by-depth
// would cap the tree in code at exactly the thing the design says not to cap.
//
// A company inside another company is different. That is nonsense at any depth, so
// it is worth refusing without assuming anything about how deep the tree goes.
//
// The reverse is NOT enforced: the root does not have to be typed "company". Nothing
// in the design says it must, and a root typed "unit" is merely odd, not broken.
const assertCompanyIsRoot = (type, parentUnitId) => {
  if (type === "company" && parentUnitId) {
    throw new AppError(
      "Only the unit at the top of the tree can be a company. Give this one a different type.",
      400,
    );
  }
};

// ---------------------------------------------------------------------------
// Invariant 4 — two units under the same parent may not share a name
// ---------------------------------------------------------------------------
// Scoped to SIBLINGS, not the whole collection. A "Backend" under Engineering and a
// "Backend" under Data are two different real things; two "Backend"s under one
// parent are a typo.
//
// This costs nothing today — the Head of HR would spot a duplicate immediately in a
// tree of eight. It is paying for later: the HR coverage screen and the Leadership
// unit report both list units by name, and two identical rows there are a problem
// nobody can resolve by looking at them.
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertNameFreeAmongSiblings = async (name, parentUnitId, excludeId) => {
  const filter = {
    parentUnitId: parentUnitId || null,
    // Case-insensitive: "Backend" and "backend" are the same unit to a reader, so
    // allowing both would defeat the point of the check.
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

// ---------------------------------------------------------------------------

exports.createUnit = async (data) => {
  const fields = pick(data, CREATABLE_FIELDS);
  if (!fields.parentUnitId) fields.parentUnitId = null;

  assertCompanyIsRoot(fields.type, fields.parentUnitId);

  if (fields.parentUnitId) {
    await assertParentIsUsable(null, fields.parentUnitId);
  } else {
    await assertNoOtherRoot();
  }

  await assertNameFreeAmongSiblings(fields.name, fields.parentUnitId);

  return OrgUnit.create(fields);
};

// Flat list, deliberately. The parent of each unit is on the record, so a caller can
// assemble the tree from this in one pass — and a flat list is the honest shape for
// a collection, where a nested one has to decide what to do with an orphan.
exports.listUnits = async () => {
  const items = await OrgUnit.find().sort({ name: 1 });
  return { items, total: items.length };
};

exports.getUnitById = async (id) => {
  const unit = await OrgUnit.findById(id);
  if (!unit) throw new AppError("Unit not found", 404);
  return unit;
};

// Load, assign, save — matching the user service, so a document hook added later
// fires here too.
exports.updateUnit = async (id, data) => {
  const unit = await OrgUnit.findById(id);
  if (!unit) throw new AppError("Unit not found", 404);

  const fields = pick(data, UPDATABLE_FIELDS);

  // What the unit will look like ONCE THE CHANGE LANDS. Every check below is about
  // the result, not about what was sent — a request changing only the type still has
  // to be judged against the parent the unit already has, and a request changing only
  // the parent still has to be judged against the name it already has.
  const nextType = "type" in fields ? fields.type : unit.type;
  const nextName = "name" in fields ? fields.name : unit.name;
  const nextParent =
    "parentUnitId" in fields ? fields.parentUnitId || null : unit.parentUnitId;

  assertCompanyIsRoot(nextType, nextParent);

  // Only re-walk the tree when the parent is actually being changed. A rename must
  // not pay for a walk to the root, and must not fail because of one.
  const parentChanged = String(nextParent) !== String(unit.parentUnitId);
  if (parentChanged) {
    if (nextParent) {
      await assertParentIsUsable(unit._id, nextParent);
    } else {
      // Detaching a unit would make it a second root. Allowed only if it already is
      // the root, which the comparison above has already ruled out.
      await assertNoOtherRoot(unit._id);
    }
  }

  // A move can collide with a name that was fine where the unit used to be, so this
  // has to run when EITHER half changes, not only on a rename.
  const nameChanged = String(nextName).trim() !== String(unit.name).trim();
  if (parentChanged || nameChanged) {
    await assertNameFreeAmongSiblings(nextName, nextParent, unit._id);
  }

  Object.assign(unit, fields);
  await unit.save();
  return unit;
};
