const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/project.service");

// `req.user` is passed straight through: coverage is one rule in coverageAuth.service.js.

exports.createProject = asyncHandler(async (req, res) => {
  const project = await service.createProject(req.body, req.user);
  res.status(201).json(project);
});

exports.listProjects = asyncHandler(async (req, res) => {
  const { on, leadId } = req.query;
  res.json(await service.listProjects({ on, leadId }));
});

exports.getProject = asyncHandler(async (req, res) => {
  res.json(await service.getProjectById(req.params.id));
});

exports.closeProject = asyncHandler(async (req, res) => {
  res.json(await service.closeProject(req.params.id, req.body.lastDay, req.user));
});

exports.getTeam = asyncHandler(async (req, res) => {
  const { from, to, on } = req.query;
  res.json(await service.teamFor(req.params.id, { from, to, on }));
});
