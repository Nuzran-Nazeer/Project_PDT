const OrgUnit = require("../models/orgunit.model");
const User = require("../models/user.model");
const UnitMembership = require("../models/unitmembership.model");
const AppError = require("../utils/AppError");
const { toDay, activeOn } = require("../utils/dateRange");
const { membershipOn } = require("./unitmembership.service");
const { leadOn, listLeads } = require("./unitlead.service");

// ⚠️ The ONE place that answers who supervises whom, so the features above cannot
// drift into four definitions of "supervisor".
//
// Your supervisor on a date is the lead of the unit you belonged to on that date,
// resolving upward past a vacancy until it finds one or runs out of tree. Derived
// every time, never stored: a `supervisorId` would be unanswerable for past dates.
//
// Belonging to no unit is a real answer, not a failure: that person has no supervisor
// and is not appraised. Callers must handle null.

// `skipUserId` stops a person coming back as their own supervisor. A lead belongs to
// the unit ABOVE the one they lead, so this can only happen at the root, where that
// rule is exempt.
const climbToLead = async (startUnitId, day, skipUserId) => {
  const seen = new Set();
  let cursor = startUnitId;

  while (cursor) {
    const step = String(cursor);

    // A looped tree would otherwise spin here forever.
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

    // No lead on this date, so the question moves up a level.
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

// The unit matters: when it is not the person's own, the answer resolved upward.
const asLead = (found) =>
  found ? { ...asPerson(found.user), leadsUnit: asUnit(found.unit) } : null;

exports.reportingLineOn = async (userId, date) => {
  const user = await User.findById(userId).select("_id name employeeId");
  if (!user) throw new AppError("Employee not found", 404);

  const day = toDay(date, "on");
  const membership = await membershipOn(userId, day);

  // No unit means no supervisor, and that is the answer rather than an error.
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

  // Units are never deleted, so a membership pointing at a missing one means direct
  // database surgery. Failing loudly beats answering "no supervisor".
  if (!ownUnit) {
    throw new AppError(
      "This person's unit no longer exists, so their reporting line cannot be worked out",
      409,
    );
  }

  const supervisor = await climbToLead(ownUnit._id, day, user._id);

  // The lead of the unit ABOVE their own, not "the supervisor's supervisor". The two
  // differ only when the person's own unit had no lead.
  //
  // ⚠️ Not specified by the design; the literal reading was chosen rather than
  // invented.
  const skipLevel = ownUnit.parentUnitId
    ? await climbToLead(ownUnit.parentUnitId, day, user._id)
    : null;

  return {
    employee: asPerson(user),
    on: day.toISOString().slice(0, 10),
    unit: asUnit(ownUnit),
    supervisor: asLead(supervisor),
    // Lets a screen explain a supervisor from a unit the employee has never heard of.
    resolvedUpward: Boolean(
      supervisor && String(supervisor.unit._id) !== String(ownUnit._id),
    ),
    skipLevel: asLead(skipLevel),
  };
};

// ⚠️ Must stay the exact mirror of climbToLead: the two answer the same fact from
// opposite ends, and two different rules would let somebody be supervised by a person
// whose team they do not appear on.
//
// The descent stops at a unit that HAS a lead. `active` is deliberately not filtered:
// a flag carrying no date would drop people from a historical answer.
const unitsSupervisedFrom = async (rootUnitId, day) => {
  const collected = [];
  const seen = new Set();
  const queue = [{ id: rootUnitId, viaVacancy: false }];

  while (queue.length) {
    const { id, viaVacancy } = queue.shift();
    const step = String(id);

    // A looped tree would otherwise spin here forever.
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

// Somebody who leads nothing gets an empty team, which is a real answer.
//
// ⚠️ No coverage check: a reader role can ask about anybody's team, not only the units
// they cover.
exports.teamOn = async (userId, date) => {
  const user = await User.findById(userId).select("_id name employeeId");
  if (!user) throw new AppError("Employee not found", 404);

  const day = toDay(date, "on");
  const { items: leadRecords } = await listLeads({ userId, on: day });

  // Keyed by unit so a shared leaderless descendant is collected once. Reached
  // DIRECTLY beats reached through a vacancy.
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

  // Status is deliberately not filtered: a leaver drops out through the dates, and
  // for a past date they should still appear.
  const memberships = unitIds.length
    ? await UnitMembership.find({ unitId: { $in: unitIds }, ...activeOn(day) })
        .populate("userId", "name employeeId designation")
        .populate("unitId", "name type")
    : [];

  const team = memberships
    // The root's lead can also be a member of it, and would otherwise appear on their
    // own team.
    .filter((m) => m.userId && String(m.userId._id) !== String(user._id))
    .map((m) => ({
      ...asPerson(m.userId),
      designation: m.userId.designation,
      unit: asUnit(m.unitId),
      // The mirror of `resolvedUpward`.
      viaVacancy: byUnit.get(String(m.unitId?._id))?.viaVacancy || false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    supervisor: asPerson(user),
    on: day.toISOString().slice(0, 10),
    // Not the same as the units their team sits in: the difference is the vacancies.
    leads: leadRecords.map((record) => asUnit(record.unitId)),
    team,
    total: team.length,
  };
};
