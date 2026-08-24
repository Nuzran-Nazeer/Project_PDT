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

// Recording who leads which unit, with dates. Supervision is read out of this
// collection rather than stored anywhere, so these records are the source of every
// "who was my supervisor" answer the system will ever give.
//
// This file only RECORDS. Answering the question -- including resolving upward when
// a unit has no lead on the date asked about -- is the reporting-line story, and
// deliberately not here.

const assertUserExists = async (userId) => {
  const user = await User.findById(userId).select("_id name");
  if (!user) throw new AppError("Employee not found", 404);
  return user;
};

const assertUnitExists = async (unitId) => {
  const unit = await OrgUnit.findById(unitId).select("_id name parentUnitId");
  if (!unit) throw new AppError("Unit not found", 404);
  return unit;
};

// ---------------------------------------------------------------------------
// A unit has at most one lead on any date
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// A lead belongs to the unit ABOVE the one they lead
// ---------------------------------------------------------------------------
// This is what keeps the reporting line pointing upward. If the lead of Backend were
// a member of Backend, they would be their own supervisor, and the chain would close
// into a loop the appraisal cannot escape. Sitting in Engineering, they supervise
// Backend and are themselves supervised by Engineering's lead -- with no special case
// anywhere.
//
// THE ROOT IS EXEMPT. Settled by Nuzran on 2026-08-25, having been raised as a gap:
// the company unit has no parent, so there is no unit its lead could belong to, and
// the design says only that a lead belongs to the parent unit.
//
// The two alternatives were both worse. Requiring the company's lead to be a member
// of the company unit makes them their own supervisor, so the reporting line would
// then need a rule whose only job is that one exception. Refusing a company lead
// outright leaves Altrium with nobody at the top.
//
// Exempting has a useful consequence rather than merely avoiding a problem: someone
// at the top who belongs to no unit has no supervisor and is not appraised, which is
// already what the design says about leadership.
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

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

// `leadOn` -- who led this unit on this date -- was written here and CUT before
// committing. Nothing in this story calls it: the filter below answers the same
// question over HTTP, and the reporting line will want it in a different shape
// anyway, since it has to resolve upward when a unit has no lead. It is kept
// verbatim in PDT-BUILD-LOG.md.
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

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

// Appointing a lead. If the unit already has one, that record is CLOSED on the same
// date rather than overwritten, so last year's appraisals keep pointing at the person
// who actually ran the unit last year.
//
// Note this differs from memberships on purpose. A second open membership is refused,
// because a person in two units is an error. A second lead is an implied handover,
// because a unit always has at most one and appointing a new one means the last one
// stopped. Both readings come straight from the story's criteria.
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

// A unit left with no lead. Allowed on purpose -- the reporting line resolves upward
// to the parent's lead, so nobody is left without a supervisor while the post is
// vacant.
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
