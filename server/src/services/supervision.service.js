const OrgUnit = require("../models/orgunit.model");
const User = require("../models/user.model");
const UnitMembership = require("../models/unitmembership.model");
const AppError = require("../utils/AppError");
const { toDay, activeOn } = require("../utils/dateRange");
const { membershipOn } = require("./unitmembership.service");
const { leadOn, listLeads } = require("./unitlead.service");

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

// ---------------------------------------------------------------------------
// Walking DOWN the tree
// ---------------------------------------------------------------------------
// The mirror of climbToLead, and it has to be, or the system contradicts itself:
// "who is my supervisor" and "who is on my team" are the same fact read from two
// ends. If they were computed by two different rules, somebody could be supervised
// by a person whose team they do not appear on, and nobody would notice until an
// appraisal went unwritten.
//
// From a unit somebody leads, their team is that unit's members PLUS the members of
// any unit below it that has no lead of its own on the date. The spec is explicit:
// "a supervisor leaves and is not replaced -- their boss writes that stretch... a
// vacancy resolves upward on its own." Read from the other end, that means the boss
// picks up the leaderless unit's people, and the walk keeps going down through a
// leaderless unit's own children.
//
// THE DESCENT STOPS AT A UNIT THAT HAS A LEAD. Those people are that lead's team,
// not this one's -- climbToLead would have stopped there too.
//
// `active` is deliberately NOT filtered. A discontinued unit holds no members, so it
// contributes nothing today; but for a PAST date it may have held people who needed
// supervising then, and filtering on a flag that carries no date would silently drop
// them from a historical answer.
const unitsSupervisedFrom = async (rootUnitId, day) => {
  const collected = [];
  const seen = new Set();
  const queue = [{ id: rootUnitId, viaVacancy: false }];

  while (queue.length) {
    const { id, viaVacancy } = queue.shift();
    const step = String(id);

    // Only reachable if the tree is already looped, which the unit service prevents
    // on every write. Same guard, same reason, as the climb.
    if (seen.has(step)) continue;
    seen.add(step);

    collected.push({ id, viaVacancy });

    const children = await OrgUnit.find({ parentUnitId: id }).select("_id");
    for (const child of children) {
      // A child with its own lead belongs to that lead, so the walk stops there.
      const childLead = await leadOn(child._id, day);
      if (childLead) continue;
      queue.push({ id: child._id, viaVacancy: true });
    }
  }

  return collected;
};

// ---------------------------------------------------------------------------
// The people somebody supervises on a date
// ---------------------------------------------------------------------------
// Story 17, criterion 1. It answers the PEOPLE, not their submissions: no cycle,
// review or feedback collection exists yet, so a submission column has nothing to
// read. This is the half of that criterion the data can support today.
//
// Somebody who leads nothing gets an empty team, which is a real answer rather than
// an error -- most people lead nothing.
//
// ⚠️ NO COVERAGE CHECK, same as the reporting line. A reader role can ask about
// anybody's team, not only the units they cover. That gate arrives with "Limit access
// to each user's own people".
exports.teamOn = async (userId, date) => {
  const user = await User.findById(userId).select("_id name employeeId");
  if (!user) throw new AppError("Employee not found", 404);

  const day = toDay(date, "on");
  const { items: leadRecords } = await listLeads({ userId, on: day });

  // Keyed by unit so two led units sharing a leaderless descendant collect it once.
  // A unit reached DIRECTLY beats the same unit reached through a vacancy, because
  // the direct answer is the more specific one and it is what the screen should say.
  const byUnit = new Map();
  for (const record of leadRecords) {
    const rootId = record.unitId?._id || record.unitId;
    if (!rootId) continue;

    for (const found of await unitsSupervisedFrom(rootId, day)) {
      const key = String(found.id);
      if (!byUnit.has(key) || !found.viaVacancy) byUnit.set(key, found);
    }
  }

  const unitIds = [...byUnit.values()].map((u) => u.id);

  // One query rather than one per unit. Empty in, nothing out -- an `$in: []` matches
  // nothing, but skipping the round trip is clearer than relying on that.
  //
  // Status is deliberately not filtered. Deactivating somebody CLOSES their
  // membership, so a leaver drops out of today's answer through the dates rather than
  // through a flag -- and for a past date they should still appear, because they were
  // on the team then.
  const memberships = unitIds.length
    ? await UnitMembership.find({ unitId: { $in: unitIds }, ...activeOn(day) })
        .populate("userId", "name employeeId designation")
        .populate("unitId", "name type")
    : [];

  const team = memberships
    // A person who leads the root can also be a member of it, because the
    // lead-sits-in-the-parent-unit rule exempts the root. Without this they appear on
    // their own team. The climb guards against the same hole from the other end.
    .filter((m) => m.userId && String(m.userId._id) !== String(user._id))
    .map((m) => ({
      ...asPerson(m.userId),
      designation: m.userId.designation,
      unit: asUnit(m.unitId),
      // True when this person is here because their own unit has no lead. A screen
      // can then explain why somebody from a unit the supervisor does not lead is on
      // their list, rather than looking like a bug. The mirror of `resolvedUpward`.
      viaVacancy: byUnit.get(String(m.unitId?._id))?.viaVacancy || false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    supervisor: asPerson(user),
    on: day.toISOString().slice(0, 10),
    // The units they actually lead, which is not the same as the units their team
    // sits in -- the difference is exactly the vacancies.
    leads: leadRecords.map((record) => asUnit(record.unitId)),
    team,
    total: team.length,
  };
};
