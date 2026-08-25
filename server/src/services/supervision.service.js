const OrgUnit = require("../models/orgunit.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { toDay } = require("../utils/dateRange");
const { membershipOn } = require("./unitmembership.service");
const { leadOn } = require("./unitlead.service");

// THE reporting line: one place that answers who supervises whom, on any date.
//
// Supervision is DERIVED, never stored. It is read out of the two dated collections
// every time it is asked for, so "who supervised her last March" answers with last
// March's facts rather than with today's. A supervisorId on the user record would
// make that question unanswerable the moment anybody moved, which is why the data
// model forbids one.
//
// Everything above this file depends on it: whose self-assessment lands on whose
// queue, which employees appear on a supervisor's dashboard, who may open whose
// review. It is deliberately the ONLY place the question is answered, so those
// features cannot drift into four slightly different definitions of "supervisor".
//
// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------
// Your supervisor on a date is the lead of the unit you belonged to on that date.
// If that unit had no lead then, the answer resolves UPWARD to the parent unit's
// lead, and keeps climbing until it finds one or runs out of tree.
//
// Your skip-level is the lead of the unit ABOVE your own, found the same way.
//
// Belonging to no unit on that date is a real answer, not a missing one: that person
// has no supervisor and is not appraised. Callers must handle null rather than treat
// it as an error.

// ---------------------------------------------------------------------------
// Walking up the tree
// ---------------------------------------------------------------------------
// `skipUserId` guards against a person coming back as their own supervisor, and it
// exists for exactly one hole in the rules.
//
// A unit's lead must belong to the unit ABOVE the one they lead, which makes
// self-supervision impossible everywhere -- EXCEPT at the root, where that check is
// deliberately exempt because the company unit has no parent. Nothing currently stops
// someone being a member of the company unit AND its lead, and without this guard
// they would supervise themselves.
//
// Climbing past themselves is the conservative reading. At the root there is nowhere
// left to climb, so the answer becomes "no supervisor" -- which is already what the
// unit-lead service says should happen to whoever sits at the top.
//
// ⚠️ The better fix is arguably to refuse that appointment in the first place, but
// that is a change to Record dated membership and leadership, which is merged.
// FLAGGED, not fixed here.
const climbToLead = async (startUnitId, day, skipUserId) => {
  const seen = new Set();
  let cursor = startUnitId;

  while (cursor) {
    const step = String(cursor);

    // Only reachable if the tree is ALREADY looped, which the unit service prevents
    // on every write. Without it a corrupted tree spins here forever and hangs the
    // request rather than failing. Same guard, same reason, as the ancestor check.
    if (seen.has(step)) {
      throw new AppError("The unit tree above this unit contains a loop", 409);
    }
    seen.add(step);

    const unit = await OrgUnit.findById(step).select("name type parentUnitId");
    if (!unit) return null;

    const record = await leadOn(step, day);
    const leadUser = record ? record.userId : null;

    if (leadUser && String(leadUser._id) !== String(skipUserId)) {
      return { user: leadUser, unit };
    }

    // No lead on this date, so the question moves up a level. This is criterion 4,
    // and it is why a vacant post does not leave a whole unit unsupervised.
    cursor = unit.parentUnitId;
  }

  // Ran out of tree: nobody above this person led anything on that date.
  return null;
};

const asPerson = (user) =>
  user
    ? { id: user._id, name: user.name, employeeId: user.employeeId }
    : null;

const asUnit = (unit) =>
  unit ? { id: unit._id, name: unit.name, type: unit.type } : null;

// A found lead, plus the unit they actually lead. The unit matters to the caller:
// when it is not the person's own unit, the answer was resolved upward, and a screen
// needs to be able to say so rather than silently showing a stranger.
const asLead = (found) =>
  found ? { ...asPerson(found.user), leadsUnit: asUnit(found.unit) } : null;

// ---------------------------------------------------------------------------
// The one exported question
// ---------------------------------------------------------------------------
// Deliberately ONE function. Narrower wrappers (supervisorOn, skipLevelOn) were
// considered and left out: nothing calls them yet, and the last story was corrected
// for exactly that -- building helpers for a story that had not arrived.
exports.reportingLineOn = async (userId, date) => {
  const user = await User.findById(userId).select("_id name employeeId");
  if (!user) throw new AppError("Employee not found", 404);

  const day = toDay(date, "on");
  const membership = await membershipOn(userId, day);

  // Criterion 3. No unit on that date means no supervisor, and that is the answer
  // rather than an error -- a new starter, someone who has left, someone at the top.
  if (!membership) {
    return {
      employee: asPerson(user),
      on: day.toISOString().slice(0, 10),
      unit: null,
      supervisor: null,
      resolvedUpward: false,
      skipLevel: null,
    };
  }

  const ownUnit = await OrgUnit.findById(membership.unitId).select(
    "name type parentUnitId",
  );

  // Units are never deleted, so this means a membership points at a unit that was
  // removed straight from the database. Failing loudly beats answering "no
  // supervisor", which would look like an ordinary result.
  if (!ownUnit) {
    throw new AppError(
      "This person's unit no longer exists, so their reporting line cannot be worked out",
      409,
    );
  }

  const supervisor = await climbToLead(ownUnit._id, day, user._id);

  // Criterion 5, read literally: the lead of the unit ABOVE their own, not "the
  // supervisor's supervisor". The two differ when the person's own unit had no lead
  // -- then the supervisor was already resolved upward and IS the unit-above's lead,
  // so both answers name the same person.
  //
  // ⚠️ NOT SPECIFIED. Whether skip-level should instead mean "the next DIFFERENT
  // person above the supervisor" is not something any criterion decides, and the
  // literal reading is the one written down. Flagged rather than invented.
  const skipLevel = ownUnit.parentUnitId
    ? await climbToLead(ownUnit.parentUnitId, day, user._id)
    : null;

  return {
    employee: asPerson(user),
    on: day.toISOString().slice(0, 10),
    unit: asUnit(ownUnit),
    supervisor: asLead(supervisor),
    // True when the person's own unit had no lead on the date and the answer came
    // from further up. A screen can then explain the answer instead of just showing
    // a name from a unit the employee has never heard of.
    resolvedUpward: Boolean(
      supervisor && String(supervisor.unit._id) !== String(ownUnit._id),
    ),
    skipLevel: asLead(skipLevel),
  };
};
