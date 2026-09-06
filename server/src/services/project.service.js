const mongoose = require("mongoose");
const Project = require("../models/project.model");
const ProjectAssignment = require("../models/projectassignment.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const {
  toDay,
  dayAfter,
  assertOrderedRange,
  activeOn,
  overlapping,
} = require("../utils/dateRange");
const { assertMayActOnEmployee } = require("./coverageAuth.service");

// Projects, and reading the team off the assignment records. Assignments themselves
// are written in projectassignment.service.js; this file owns the project and the one
// operation that touches both, which is closing.

const isoDay = (date) => date.toISOString().slice(0, 10);

// Case-insensitive, and it MUST match the collation on the model's unique index, or
// this lookup searches case-sensitively, finds nothing, and leaves the index to refuse
// what should have been a readable message.
const NAME_COLLATION = { locale: "en", strength: 2 };

// The [from, to) rule, expressed over this collection's field names. Not `activeOn`
// itself: that reads `from`/`to`, and a project's period is startDate/endDate.
const runningOn = (day) => ({
  startDate: { $lte: day },
  $or: [{ endDate: null }, { endDate: { $gt: day } }],
});

const assertLeadIsAssignable = async (userId) => {
  const user = await User.findById(userId).select("_id name status");
  if (!user) throw new AppError("Employee not found", 404);
  if (user.status !== "active") {
    throw new AppError(`${user.name} is not active, so they cannot lead a project`, 409);
  }
  return user;
};

// A readable refusal for the ordinary case. The unique index on the model is what
// makes it safe under concurrency; this is what makes it legible.
const assertNameFreeAmongOpen = async (name) => {
  const clash = await Project.findOne({ name, endDate: null })
    .collation(NAME_COLLATION)
    .select("name");

  if (clash) {
    throw new AppError(
      `${clash.name} is already running. Close it before opening another project with the same name.`,
      409,
    );
  }
};

// Two concurrent creates can both pass the check above and both reach the insert. The
// second one comes back as a duplicate-key error, which is a 409 in every sense except
// the one Mongo reports it as.
const asNameConflict = (err, name) => {
  // `cause` as well as the error itself: a duplicate key raised inside a transaction
  // can arrive wrapped, and an unrecognised one would surface as a 500 for what is
  // plainly a name clash.
  const duplicate = err?.code === 11000 || err?.cause?.code === 11000;
  if (!duplicate) return err;
  return new AppError(
    `${name} is already running. Close it before opening another project with the same name.`,
    409,
  );
};

// Unpopulated, for the write paths: they save the document afterwards.
const findProjectOr404 = async (id) => {
  const project = await Project.findById(id);
  if (!project) throw new AppError("Project not found", 404);
  return project;
};

// Reading

exports.getProjectById = async (id) => {
  const project = await Project.findById(id).populate("leadId", "name employeeId");
  if (!project) throw new AppError("Project not found", 404);
  return project;
};

exports.listProjects = async ({ on, leadId } = {}) => {
  const filter = {};
  if (leadId) filter.leadId = leadId;
  if (on) Object.assign(filter, runningOn(toDay(on, "on")));

  const items = await Project.find(filter)
    .sort({ startDate: -1 })
    .populate("leadId", "name employeeId");

  return { items, total: items.length };
};

const asPerson = (user) =>
  user ? { id: user._id, name: user.name, employeeId: user.employeeId } : null;

// AC4, and AC5's half of the answer.
//
// Two modes. `from`+`to` asks about a PERIOD and matches anything overlapping it;
// `on`, or nothing, asks about a single day. They return different keys on purpose:
// one day has one team lead, a period can have several.
//
// ⚠️ ROWS ARE GROUPED BY PERSON. Changing the team lead splits an assignment into two
// adjacent rows, so a period query can match the same employee more than once. Each
// person appears once, with every matching stretch in `periods`.
exports.teamFor = async (id, { from, to, on } = {}) => {
  const project = await exports.getProjectById(id);

  const periodMode = Boolean(from && to);
  let filter;
  let window;

  if (periodMode) {
    const start = toDay(from, "from");
    const end = toDay(to, "to");
    assertOrderedRange(start, end);
    filter = overlapping(start, end);
    window = { from: isoDay(start), to: isoDay(end) };
  } else {
    const day = toDay(on || new Date(), "on");
    filter = activeOn(day);
    window = { on: isoDay(day) };
  }

  const rows = await ProjectAssignment.find({ projectId: project._id, ...filter })
    .sort({ from: 1 })
    .populate("userId", "name employeeId designation");

  const byUser = new Map();
  for (const row of rows) {
    // A row pointing at a deleted user would otherwise appear as a nameless member.
    // Nothing deletes users, so this is a guard, not a case.
    if (!row.userId) continue;

    const key = String(row.userId._id);
    if (!byUser.has(key)) byUser.set(key, { person: row.userId, periods: [] });

    byUser.get(key).periods.push({
      from: row.from,
      to: row.to,
      isTeamLead: row.isTeamLead,
    });
  }

  const members = [...byUser.values()]
    .map((entry) => ({
      ...asPerson(entry.person),
      designation: entry.person.designation,
      // Only meaningful on a single date, where one row per person can match. Over a
      // period it would have to summarise several rows, so `periods` carries it
      // instead.
      ...(periodMode ? {} : { isTeamLead: entry.periods.some((p) => p.isTeamLead) }),
      periods: entry.periods,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Sorted by `from` already, so the history reads in order.
  const leadRows = rows.filter((row) => row.isTeamLead && row.userId);

  const teamLeadKey = periodMode
    ? {
        teamLeadHistory: leadRows.map((row) => ({
          ...asPerson(row.userId),
          from: row.from,
          to: row.to,
        })),
      }
    : { teamLead: leadRows.length ? asPerson(leadRows[0].userId) : null };

  return {
    project: {
      id: project._id,
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      lead: asPerson(project.leadId),
    },
    ...window,
    members,
    ...teamLeadKey,
    total: members.length,
  };
};

// Writing

// AC1. Creating a project also opens its lead's assignment, so the person running the
// work appears on its team without HR recording the same fact twice.
//
// The lead's assignment starts as `isTeamLead: false`: leading a PROJECT and leading
// its TEAM are separate roles, and REVIEWER_TYPES carries them separately.
exports.createProject = async ({ name, leadId, startDate }, actor) => {
  await assertLeadIsAssignable(leadId);

  const start = toDay(startDate, "startDate");

  // Coverage is judged on the lead, on the day the project starts. The assignment
  // opened below is for the same person on the same date, so it needs no second check.
  await assertMayActOnEmployee(actor, leadId, start, "create this project");

  const trimmed = String(name).trim();
  await assertNameFreeAmongOpen(trimmed);

  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const [project] = await Project.create(
        [{ name: trimmed, leadId, startDate: start, endDate: null }],
        { session },
      );

      // A brand-new project has no other rows, so there is nothing this could overlap.
      await ProjectAssignment.create(
        [
          {
            projectId: project._id,
            userId: leadId,
            from: start,
            to: null,
            isTeamLead: false,
          },
        ],
        { session },
      );

      created = project;
    });
    return created;
  } catch (err) {
    throw asNameConflict(err, trimmed);
  } finally {
    await session.endSession();
  }
};

// AC3. The project's end date and every assignment's end date are the SAME value, and
// nothing is deleted.
//
// ⚠️ `overlapping(closesOn, null)` rather than `{ to: null }`, and the difference
// matters: it catches an assignment already carrying an end date LATER than the
// closing date, which would otherwise outlast the project it belongs to. It also
// catches one starting after the closing date, which is refused below rather than
// written -- exactly the reason orgunit.service.js uses the same expression when
// discontinuing a unit.
exports.closeProject = async (id, lastDay, actor) => {
  const project = await findProjectOr404(id);

  if (project.endDate) {
    throw new AppError(`${project.name} has already been closed`, 409);
  }

  const finalDay = toDay(lastDay, "lastDay");

  // On the LAST DAY IT OPERATES, not the storage form below: the question is who
  // covered the lead while the project was still running.
  await assertMayActOnEmployee(actor, project.leadId, finalDay, "close this project");

  const closesOn = dayAfter(finalDay);

  const affected = await ProjectAssignment.find({
    projectId: project._id,
    ...overlapping(closesOn, null),
  }).populate("userId", "name");

  // ⚠️ EVERY row is checked before the first save. Validating inside the writing loop
  // would close half the team and then throw, leaving a project that is neither open
  // nor properly closed.
  for (const row of affected) {
    if (row.from.getTime() >= closesOn.getTime()) {
      throw new AppError(
        `${row.userId?.name || "Someone"} is assigned to ${project.name} from ${isoDay(
          row.from,
        )}, which is on or after this closing date. Correct that assignment before closing the project.`,
        409,
      );
    }
    assertOrderedRange(row.from, closesOn);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const row of affected) {
        row.to = closesOn;
        await row.save({ session });
      }

      project.endDate = closesOn;
      await project.save({ session });
    });
    return project;
  } finally {
    await session.endSession();
  }
};
