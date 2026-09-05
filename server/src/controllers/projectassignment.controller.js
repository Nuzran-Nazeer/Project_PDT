const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/projectassignment.service");

exports.createAssignment = asyncHandler(async (req, res) => {
  const record = await service.createAssignment(req.body, req.user);
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
  res.json(await service.closeAssignment(req.params.id, req.body.to, req.user));
});

exports.markTeamLead = asyncHandler(async (req, res) => {
  res.json(await service.markTeamLead(req.params.id, req.body.from, req.user));
});
