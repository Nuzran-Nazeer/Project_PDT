const User = require("../models/user.model");
const OrgUnit = require("../models/orgunit.model");
const UnitMembership = require("../models/unitmembership.model");
const AppError = require("../utils/AppError");
const { toDay, activeOn } = require("../utils/dateRange");
const { membershipOn } = require("./unitmembership.service");
const { coverageOn } = require("./hrcoverage.service");

// ⚠️ THE ONE PLACE THAT DECIDES WHICH PEOPLE AND UNITS AN HR OFFICER MAY SEE OR ACT ON.
// No caller may reimplement it, and no caller may work around it by reading coverage
// directly. The routes keep their coarse role gates; these are the fine checks beneath,
// which depend on which person or unit, on which date.

const UNRESTRICTED_ROLE = "head_of_hr";
const SCOPED_ROLE = "hr";
// Read the whole roster: Leadership reads people data and never writes it.
const ROSTER_READERS = ["head_of_hr", "leadership"];

const isoDay = (date) => date.toISOString().slice(0, 10);
const holds = (actor, role) => (actor?.roles || []).includes(role);
const same = (a, b) => String(a) === String(b);

const coversResolved = (coverage, actor) =>
  [coverage.primary, coverage.backup].some(
    (holder) => holder && same(holder.id, actor.id),
  );

/**
 * Refuses unless `actor` may act on `employeeId` as at `on`.
 *
 * The Head of HR passes unconditionally. An HR officer passes only as the effective primary
 * or backup covering that person's unit on that date. `action` completes the refusal
 * message ("close this project").
 *
 * ⚠️ Somebody in no unit is a REFUSAL unless `allowUnplaced`: an unknown owner is not
 * permission. Only records HR must reach to place a new starter pass it.
 */
exports.assertMayActOnEmployee = async (
  actor,
  employeeId,
  on,
  action,
  { allowUnplaced = false } = {},
) => {
  if (holds(actor, UNRESTRICTED_ROLE)) return;

  if (!holds(actor, SCOPED_ROLE)) {
    throw new AppError("You do not have permission for this action", 403);
  }

  const day = toDay(on, "date");
  const employee = await User.findById(employeeId).select("name");
  const who = employee?.name || "This employee";

  const membership = await membershipOn(employeeId, day);
  if (!membership) {
    if (allowUnplaced) return;
    throw new AppError(
      `${who} was not in any unit on ${isoDay(day)}, so nobody covers them. Only the Head of HR can ${action}.`,
      403,
    );
  }

  const coverage = await coverageOn(membership.unitId, day);
  if (!coverage.primary && !coverage.backup) {
    throw new AppError(
      `No HR officer covers ${coverage.requestedUnit?.name || "this person's unit"} on ${isoDay(day)}, so only the Head of HR can ${action}.`,
      403,
    );
  }

  if (!coversResolved(coverage, actor)) {
    throw new AppError(
      `You do not cover ${who} on ${isoDay(day)}, so you cannot ${action}.`,
      403,
    );
  }
};

// Review content as HR: coverage only. Holding Leadership as well grants nothing here.
exports.assertHrMayRead = (actor, employeeId, on = new Date()) =>
  exports.assertMayActOnEmployee(actor, employeeId, on, "view this person's reviews");

// An employee record: yourself, anyone for a roster reader, otherwise HR coverage with
// people in no unit included, so new starters can be found.
exports.assertMayReadEmployee = async (actor, employeeId, on = new Date()) => {
  if (same(employeeId, actor?.id)) return;
  if (ROSTER_READERS.some((role) => holds(actor, role))) return;

  await exports.assertMayActOnEmployee(
    actor,
    employeeId,
    on,
    "view this person's record",
    {
      allowUnplaced: true,
    },
  );
};

exports.assertCoversUnit = async (actor, unitId, on, action) => {
  if (holds(actor, UNRESTRICTED_ROLE)) return;
  if (!holds(actor, SCOPED_ROLE)) {
    throw new AppError("You do not have permission for this action", 403);
  }

  const day = toDay(on, "date");
  const coverage = await coverageOn(unitId, day);
  if (!coversResolved(coverage, actor)) {
    throw new AppError(
      `You do not cover ${coverage.requestedUnit?.name || "this unit"} on ${isoDay(day)}, so you cannot ${action}.`,
      403,
    );
  }
};

// The Head of HR creates anything anywhere; an officer creates sub-units only, inside a
// unit they cover.
exports.assertMayCreateUnit = async (actor, { type, parentUnitId }, on = new Date()) => {
  if (holds(actor, UNRESTRICTED_ROLE)) return;

  if (type !== "sub-unit" || !parentUnitId) {
    throw new AppError(
      "An HR officer can create only a sub-unit, inside a unit they cover",
      403,
    );
  }
  await exports.assertCoversUnit(actor, parentUnitId, on, "create a sub-unit inside it");
};

/**
 * A predicate for filtering a list of people: is this person within the actor's reach today?
 * Built once per request, because resolving coverage per person repeats the same tree walk.
 *
 * `asHr` ignores Leadership, for lists that carry review state rather than a roster.
 */
exports.readScopeFor = async (actor, { on = new Date(), asHr = false } = {}) => {
  if (holds(actor, UNRESTRICTED_ROLE)) return () => true;
  if (!asHr && ROSTER_READERS.some((role) => holds(actor, role))) return () => true;
  if (!holds(actor, SCOPED_ROLE)) return (userId) => same(userId, actor?.id);

  const day = toDay(on, "date");
  const covered = new Set();
  for (const unit of await OrgUnit.find().select("_id")) {
    if (coversResolved(await coverageOn(unit._id, day), actor))
      covered.add(String(unit._id));
  }

  const memberships = await UnitMembership.find(activeOn(day))
    .select("userId unitId")
    .lean();
  const unitOf = new Map(memberships.map((m) => [String(m.userId), String(m.unitId)]));

  return (userId) => {
    if (same(userId, actor.id)) return true;
    const unitId = unitOf.get(String(userId));
    return !unitId || covered.has(unitId);
  };
};
