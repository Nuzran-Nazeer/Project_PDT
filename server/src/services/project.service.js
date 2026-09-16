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

// Assignments are written in projectassignment.service.js; this file owns the project
// and closing, the one operation that touches both.

const isoDay = (date) => date.toISOString().slice(0, 10);

// ⚠️ Must match the collation on the model's unique index, or the lookup finds nothing
// and the index refuses what should have been a readable message.
const NAME_COLLATION = { locale: "en", strength: 2 };

// `activeOn` over startDate/endDate instead of from/to.
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

// The unique index makes this safe under concurrency; this makes it legible.
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

// A duplicate key raised inside a transaction can arrive wrapped in `cause`.
const asNameConflict = (err, name) => {
  const duplicate = err?.code === 11000 || err?.cause?.code === 11000;
  if (!duplicate) return err;
  return new AppError(
    `${name} is already running. Close it before opening another project with the same name.`,
    409,
  );
};

const findProjectOr404 = async (id) => {
  const project = await Project.findById(id);
  if (!project) throw new AppError("Project not found", 404);
  return project;
};

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

// `from`+`to` asks about a period and returns `teamLeadHistory`; `on` asks about a day
// and returns `teamLead`. Rows are grouped by person: a lead change splits an assignment.
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
      // Only meaningful on a single date; over a period `periods` carries it.
      ...(periodMode ? {} : { isTeamLead: entry.periods.some((p) => p.isTeamLead) }),
      periods: entry.periods,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

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

// Creating a project also opens its lead's assignment, as `isTeamLead: false`: leading
// a project and leading its team are separate roles.
exports.createProject = async ({ name, leadId, startDate }, actor) => {
  await assertLeadIsAssignable(leadId);

  const start = toDay(startDate, "startDate");

  // Coverage is judged on the lead on the start date; the assignment below needs no second check.
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

// ⚠️ `overlapping(closesOn, null)` rather than `{ to: null }`: it also catches an
// assignment ending later than the closing date, or starting after it.
exports.closeProject = async (id, lastDay, actor) => {
  const project = await findProjectOr404(id);

  if (project.endDate) {
    throw new AppError(`${project.name} has already been closed`, 409);
  }

  const finalDay = toDay(lastDay, "lastDay");

  // Judged on the last day it operates, not the storage form below.
  await assertMayActOnEmployee(actor, project.leadId, finalDay, "close this project");

  const closesOn = dayAfter(finalDay);

  const affected = await ProjectAssignment.find({
    projectId: project._id,
    ...overlapping(closesOn, null),
  }).populate("userId", "name");

  // ⚠️ Every row is checked before the first save, or half the team closes and then it throws.
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
