const mongoose = require("mongoose");
const ProjectAssignment = require("../models/projectassignment.model");
const Project = require("../models/project.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const {
  toDay,
  assertOrderedRange,
  activeOn,
  overlapping,
} = require("../utils/dateRange");
const { assertMayActOnEmployee } = require("./coverageAuth.service");

// Putting people on projects, with dates. Nothing is ever overwritten: a change closes
// one record and opens another, which is what keeps "who was on Apollo in March"
// answerable after the team has moved on.

const isoDay = (date) => date.toISOString().slice(0, 10);

const assertUserIsAssignable = async (userId) => {
  const user = await User.findById(userId).select("_id name status");
  if (!user) throw new AppError("Employee not found", 404);
  if (user.status !== "active") {
    throw new AppError(
      `${user.name} is not active, so they cannot be assigned to a project`,
      409,
    );
  }
  return user;
};

// ⚠️ A CLOSED PROJECT ACCEPTS NOTHING, including a backfill of work that really
// happened. Assignments are recorded while the project runs; afterwards its team is
// settled history and closing it is what settled it.
const assertProjectIsOpen = async (projectId) => {
  const project = await Project.findById(projectId).select("_id name startDate endDate");
  if (!project) throw new AppError("Project not found", 404);

  if (project.endDate) {
    throw new AppError(
      `${project.name} has been closed, so nothing can be assigned to it. Assignments have to be recorded before the project closes.`,
      409,
    );
  }
  return project;
};

// ⚠️ Scoped to ONE project. Two overlapping records on the same project make "when did
// she join Apollo" ambiguous, so they are refused -- but the same person on two
// DIFFERENT projects at once is the normal case and is deliberately untouched by this
// filter.
const assertNoOverlapOnProject = async (project, userId, from, to, excludeId) => {
  const filter = { projectId: project._id, userId, ...overlapping(from, to) };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await ProjectAssignment.findOne(filter);
  if (!clash) return;

  const ends = clash.to ? ` until ${isoDay(clash.to)}` : ", still open";
  throw new AppError(
    `This person is already assigned to ${project.name} from ${isoDay(clash.from)}${ends}. Close that assignment before opening another.`,
    409,
  );
};

// The open team-lead row, if the project currently has one.
const openTeamLead = async (projectId) =>
  ProjectAssignment.findOne({ projectId, isTeamLead: true, to: null });

// ⚠️ The partial unique index constrains OPEN rows only, so it cannot see a backdated
// change landing inside a team-lead period that has already been closed. Amali leading
// January to June and Bob being made team lead from March is two leads at once, and
// this is the only thing that catches it.
const assertNoOtherTeamLead = async (projectId, from, excludeId) => {
  const filter = { projectId, isTeamLead: true, ...overlapping(from, null) };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await ProjectAssignment.findOne(filter).populate("userId", "name");
  if (!clash) return;

  const ends = clash.to ? ` until ${isoDay(clash.to)}` : "";
  throw new AppError(
    `${clash.userId?.name || "Someone"} is already team lead of this project from ${isoDay(clash.from)}${ends}. A project has one team lead at a time.`,
    409,
  );
};

// Reading

exports.listAssignments = async ({ projectId, userId, on } = {}) => {
  const filter = {};
  if (projectId) filter.projectId = projectId;
  if (userId) filter.userId = userId;
  if (on) Object.assign(filter, activeOn(toDay(on, "on")));

  const items = await ProjectAssignment.find(filter)
    .sort({ from: -1 })
    .populate("userId", "name employeeId")
    .populate("projectId", "name startDate endDate");

  return { items, total: items.length };
};

exports.getAssignmentById = async (id) => {
  const record = await ProjectAssignment.findById(id);
  if (!record) throw new AppError("Assignment not found", 404);
  return record;
};

// Writing

// AC2. `to` is optional: present only when recording a stint whose end is already
// known, absent for ongoing work.
exports.createAssignment = async ({ projectId, userId, from, to }, actor) => {
  await assertUserIsAssignable(userId);
  const project = await assertProjectIsOpen(projectId);

  const start = toDay(from, "from");
  const end = to ? toDay(to, "to") : null;
  assertOrderedRange(start, end);

  await assertMayActOnEmployee(actor, userId, start, "assign this person to a project");

  if (start.getTime() < project.startDate.getTime()) {
    throw new AppError(
      `${project.name} starts on ${isoDay(project.startDate)}, so nobody can be assigned to it before then`,
      400,
    );
  }

  await assertNoOverlapOnProject(project, userId, start, end);

  return ProjectAssignment.create({
    projectId: project._id,
    userId,
    from: start,
    to: end,
    isTeamLead: false,
  });
};

// Ending one person's stint without closing the project.
exports.closeAssignment = async (id, to, actor) => {
  const record = await exports.getAssignmentById(id);

  if (record.to) {
    throw new AppError("This assignment has already ended", 409);
  }

  const end = toDay(to, "to");
  await assertMayActOnEmployee(actor, record.userId, end, "close this assignment");

  assertOrderedRange(record.from, end);

  record.to = end;
  await record.save();
  return record;
};

// AC5. Recorded by CLOSING AND REOPENING rather than flipping `isTeamLead`, so the
// previous team lead's period survives as a record of who led when.
//
// Up to four writes: the outgoing lead's row is closed and reopened without the role
// (they stay on the project, they just stop leading it), and the incoming row is
// closed and reopened with it.
exports.markTeamLead = async (id, from, actor) => {
  const record = await exports.getAssignmentById(id);

  if (record.to) {
    throw new AppError(
      "This assignment has already ended, so it cannot be made team lead",
      409,
    );
  }
  if (record.isTeamLead) {
    throw new AppError("This assignment is already the team lead", 409);
  }

  const start = toDay(from, "from");
  await assertMayActOnEmployee(actor, record.userId, start, "change the team lead");

  // ⚠️ BOTH DATE CHECKS RUN BEFORE ANY WRITE. Without them a backdated change closes a
  // row before it began, or leaves one covering no days at all.
  if (start.getTime() <= record.from.getTime()) {
    throw new AppError(
      `The change date must be after ${isoDay(record.from)}, when this assignment began`,
      400,
    );
  }

  const current = await openTeamLead(record.projectId);

  if (current && start.getTime() <= current.from.getTime()) {
    throw new AppError(
      `The change date must be after ${isoDay(current.from)}, when the current team lead took over. Earlier history is not rewritten.`,
      400,
    );
  }

  // `current` is excluded because closing it, below, is what makes way for this
  // change: afterwards it ends exactly where the new period begins, so the two do not
  // overlap. Anything else still holding the role over this period is a real clash.
  await assertNoOtherTeamLead(record.projectId, start, current?._id);

  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      // Closed BEFORE the new leading row is created, or the two would both be open
      // and trip the partial unique index.
      if (current) {
        current.to = start;
        await current.save({ session });

        await ProjectAssignment.create(
          [
            {
              projectId: current.projectId,
              userId: current.userId,
              from: start,
              to: null,
              isTeamLead: false,
            },
          ],
          { session },
        );
      }

      record.to = start;
      await record.save({ session });

      const [next] = await ProjectAssignment.create(
        [
          {
            projectId: record.projectId,
            userId: record.userId,
            from: start,
            to: null,
            isTeamLead: true,
          },
        ],
        { session },
      );

      created = next;
    });
    return created;
  } finally {
    await session.endSession();
  }
};
