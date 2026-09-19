const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/projectassignment.service");
const audit = require("../services/audit.service");

exports.createAssignment = asyncHandler(async (req, res) => {
  const record = await service.createAssignment(req.body, req.user);
  await audit.recordHistoryEdit({
    actor: req.user,
    targetType: "projectAssignment",
    record,
    subjectUserId: record.userId,
    detail: "Assigned this person to a project",
    from: record.from,
    to: record.to,
  });
  res.status(201).json(record);
});

exports.listAssignments = asyncHandler(async (req, res) => {
  const { projectId, userId, on } = req.query;
  res.json(await service.listAssignments({ projectId, userId, on }));
});

exports.getAssignment = asyncHandler(async (req, res) => {
  res.json(await service.getAssignmentById(req.params.id));
});

exports.closeAssignment = asyncHandler(async (req, res) => {
  const closed = await service.closeAssignment(req.params.id, req.body.to, req.user);
  await audit.recordHistoryEdit({
    actor: req.user,
    targetType: "projectAssignment",
    record: closed,
    subjectUserId: closed.userId,
    detail: "Ended this person's assignment to a project",
    from: closed.from,
    to: closed.to,
  });
  res.json(closed);
});

exports.markTeamLead = asyncHandler(async (req, res) => {
  res.json(await service.markTeamLead(req.params.id, req.body.from, req.user));
});
