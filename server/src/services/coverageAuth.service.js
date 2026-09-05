const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { toDay } = require("../utils/dateRange");
const { membershipOn } = require("./unitmembership.service");
const { coverageOn } = require("./hrcoverage.service");

// ⚠️ THE ONE PLACE THAT DECIDES WHETHER AN HR OFFICER MAY ACT ON A PARTICULAR PERSON.
// Deliberately its own file with a single exported function: this rule is expected to
// change, and when it does it should change HERE and nowhere else. No caller may
// reimplement it, and no caller may work around it by reading coverage directly.
//
// The routes keep their coarse `authorize("hr", "head_of_hr")` gate. This is the fine
// one underneath it, and it is enforced in the SERVICE rather than in a route, because
// the answer depends on request data -- which employee, on which date -- that a route
// gate cannot see.

// Reads are never scoped by coverage. Cross-unit work has to be visible or the
// collection cannot do the job it exists for, so only writes reach this file.
const UNRESTRICTED_ROLE = "head_of_hr";
const SCOPED_ROLE = "hr";

const isoDay = (date) => date.toISOString().slice(0, 10);

/**
 * Refuses unless `actor` may act on `employeeId` as at `on`.
 *
 * The Head of HR passes unconditionally. An HR officer passes only when they are the
 * effective primary or backup covering that person on that date, resolved as:
 *
 *   1. the employee's unit membership on the date
 *   2. HR coverage for that unit, through coverageOn(), which climbs the tree and
 *      stops at the first unit with direct coverage
 *   3. whether the actor is that unit's primary or backup
 *
 * `action` is a fragment for the refusal message ("close this project"), so the person
 * refused is told what was refused rather than just that something was.
 *
 * ⚠️ No membership and no coverage are both REFUSALS for an HR officer, not silent
 * passes: an unknown owner is not the same as permission.
 */
exports.assertMayActOnEmployee = async (actor, employeeId, on, action) => {
  const held = actor?.roles || [];

  if (held.includes(UNRESTRICTED_ROLE)) return;

  // Unreachable behind the route gate, and checked anyway: this function must be safe
  // to call from anywhere, including a route somebody forgets to gate.
  if (!held.includes(SCOPED_ROLE)) {
    throw new AppError("You do not have permission for this action", 403);
  }

  const day = toDay(on, "date");

  // Named in every message below. Callers have already established the person exists,
  // so a missing name here is a fallback rather than a case to handle.
  const employee = await User.findById(employeeId).select("name");
  const who = employee?.name || "This employee";

  const membership = await membershipOn(employeeId, day);
  if (!membership) {
    throw new AppError(
      `${who} was not in any unit on ${isoDay(day)}, so nobody covers them. Only the Head of HR can ${action}.`,
      403,
    );
  }

  const coverage = await coverageOn(membership.unitId, day);
  const holders = [coverage.primary, coverage.backup].filter(Boolean);

  if (!holders.length) {
    throw new AppError(
      `No HR officer covers ${coverage.requestedUnit?.name || "this person's unit"} on ${isoDay(day)}, so only the Head of HR can ${action}.`,
      403,
    );
  }

  const covers = holders.some((holder) => String(holder.id) === String(actor.id));
  if (!covers) {
    throw new AppError(
      `You do not cover ${who} on ${isoDay(day)}, so you cannot ${action}.`,
      403,
    );
  }
};
