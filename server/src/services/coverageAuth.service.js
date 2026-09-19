const User = require("../models/user.model");
const UnitMembership = require("../models/unitmembership.model");
const AppError = require("../utils/AppError");
const { toDay, activeOn } = require("../utils/dateRange");
const { membershipOn } = require("./unitmembership.service");
const { coverageOn, loadCoverageOn, resolveCoverage } = require("./hrcoverage.service");
const { chainAboveOn } = require("./supervision.service");
const { RESTRICTED_ROLES } = require("../config/constants");

// ⚠️ The one place that decides what an HR officer may see or do: which people and units they
// reach, and which roles they may hand out. No caller may reimplement it or read coverage
// directly instead.

const UNRESTRICTED_ROLE = "head_of_hr";
const SCOPED_ROLE = "hr";
const ROSTER_READERS = ["head_of_hr", "leadership"];

const isoDay = (date) => date.toISOString().slice(0, 10);
const holds = (actor, role) => (actor?.roles || []).includes(role);
const same = (a, b) => String(a) === String(b);

const coversResolved = (coverage, actor) =>
  [coverage.primary, coverage.backup].some(
    (holder) => holder && same(holder.id, actor.id),
  );

// `action` completes the refusal message ("close this project").
// ⚠️ Somebody in no unit is a refusal unless `allowUnplaced`: an unknown owner is not permission.
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

  // ⚠️ These three refusals reach only somebody who is not entitled — an officer who covers the
  // person never sees them — so naming the employee or their unit would hand an out-of-scope
  // account real names and unit shapes to map, the way "Review not found" elsewhere refuses to.
  const membership = await membershipOn(employeeId, day);
  if (!membership) {
    if (allowUnplaced) return;
    throw new AppError(
      `This employee was not in any unit on ${isoDay(day)}, so nobody covers them. Only the Head of HR can ${action}.`,
      403,
    );
  }

  const coverage = await coverageOn(membership.unitId, day);
  if (!coverage.primary && !coverage.backup) {
    throw new AppError(
      `No HR officer covers this employee's unit on ${isoDay(day)}, so only the Head of HR can ${action}.`,
      403,
    );
  }

  if (!coversResolved(coverage, actor)) {
    throw new AppError(
      `You do not cover this employee on ${isoDay(day)}, so you cannot ${action}.`,
      403,
    );
  }
};

// ⚠️ Not coverage, but the same question: what may this actor do. Granting an unrestricted role
// is how an officer escapes coverage altogether, so it is checked wherever roles are written.
// Taking one away is guarded too — demoting the Head of HR is how their oversight is removed.
// The comparison is against what the person already holds, so resending an unchanged list is
// not a grant and an ordinary edit to a leadership-holder's record still goes through.
exports.assertMayGrantRoles = (actor, roles, currentRoles = []) => {
  if (roles === undefined) return;
  if (holds(actor, UNRESTRICTED_ROLE)) return;

  const restrictedIn = (list) =>
    RESTRICTED_ROLES.filter((role) => (Array.isArray(list) ? list : []).includes(role));

  const before = restrictedIn(currentRoles);
  const after = restrictedIn(roles);
  const changed = RESTRICTED_ROLES.filter(
    (role) => before.includes(role) !== after.includes(role),
  );
  if (!changed.length) return;

  throw new AppError(
    `Only the Head of HR can grant or remove ${changed.join(", ")}.`,
    403,
  );
};

// Coverage only: holding Leadership as well grants nothing here.
exports.assertHrMayRead = (actor, employeeId, on = new Date()) =>
  exports.assertMayActOnEmployee(actor, employeeId, on, "view this person's reviews");

// People in no unit are included, so new starters can be found.
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

// Chain-neutrality: covering a unit is not enough to act on somebody you report to or who
// reports to you. ⚠️ The Head of HR is exempt because they are where these cases escalate to;
// blocking them as well would leave the escalation with nowhere to go.
exports.assertNotInReportingLine = async (actor, employeeId, on, action) => {
  if (holds(actor, UNRESTRICTED_ROLE)) return;

  const day = toDay(on, "date");
  const [aboveEmployee, aboveActor] = await Promise.all([
    chainAboveOn(employeeId, day),
    chainAboveOn(actor.id, day),
  ]);

  const shared =
    aboveEmployee.includes(String(actor.id)) || aboveActor.includes(String(employeeId));
  if (!shared) return;

  const employee = await User.findById(employeeId).select("name");
  throw new AppError(
    `You are in ${employee?.name || "this employee"}'s reporting line, so you cannot ${action}. The Head of HR can.`,
    403,
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

// Empty for anyone without the officer role; the Head of HR's reach is the caller's to handle.
exports.coveredUnitIds = async (actor, on = new Date()) => {
  const covered = new Set();
  if (!holds(actor, SCOPED_ROLE)) return covered;

  const snapshot = await loadCoverageOn(toDay(on, "date"));
  for (const unitId of snapshot.units.keys()) {
    if (coversResolved(resolveCoverage(snapshot, unitId), actor)) covered.add(unitId);
  }
  return covered;
};

// A predicate built once per request: resolving coverage per person repeats the tree walk.
// `asHr` ignores Leadership, for lists that carry review state rather than a roster.
// `includeUnplaced` is the roster rule (somebody in no unit is shown so they can be found);
// a list of reviews passes false, matching the per-person check, which refuses them.
exports.readScopeFor = async (
  actor,
  { on = new Date(), asHr = false, includeUnplaced = true } = {},
) => {
  if (holds(actor, UNRESTRICTED_ROLE)) return () => true;
  if (!asHr && ROSTER_READERS.some((role) => holds(actor, role))) return () => true;
  if (!holds(actor, SCOPED_ROLE)) return (userId) => same(userId, actor?.id);

  const day = toDay(on, "date");
  const covered = await exports.coveredUnitIds(actor, day);

  const memberships = await UnitMembership.find(activeOn(day))
    .select("userId unitId")
    .lean();
  const unitOf = new Map(memberships.map((m) => [String(m.userId), String(m.unitId)]));

  return (userId) => {
    if (same(userId, actor.id)) return true;
    const unitId = unitOf.get(String(userId));
    if (!unitId) return includeUnplaced;
    return covered.has(unitId);
  };
};
