const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/project.service");

// Thin, as everywhere: read the request, call the service, shape the response.
//
// ⚠️ `req.user` is passed straight through to the write paths and nothing is decided
// here. Whether an HR officer may act on this particular person on this particular
// date is one rule in coverageAuth.service.js, and a controller re-deciding any part
// of it would be a second copy of it.

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

// Who was on the project: `from`+`to` for a period, `on` for a single day, neither for
// today.
exports.getTeam = asyncHandler(async (req, res) => {
  const { from, to, on } = req.query;
  res.json(await service.teamFor(req.params.id, { from, to, on }));
});
