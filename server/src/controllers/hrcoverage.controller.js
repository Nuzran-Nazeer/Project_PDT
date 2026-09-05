const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/hrcoverage.service");

exports.assignCoverage = asyncHandler(async (req, res) => {
  const record = await service.assignCoverage(req.body);
  res.status(201).json(record);
});

exports.closeCoverage = asyncHandler(async (req, res) => {
  res.json(await service.closeCoverage(req.params.id, req.body.to));
});

exports.listCoverage = asyncHandler(async (req, res) => {
  const { unitId, userId, role, on } = req.query;
  res.json(await service.listCoverage({ unitId, userId, role, on }));
});

exports.getCoverage = asyncHandler(async (req, res) => {
  res.json(await service.getCoverageById(req.params.id));
});

// The resolved answer for a unit on a date: who covers it, direct or inherited.
exports.getEffectiveCoverage = asyncHandler(async (req, res) => {
  const on = req.query.on || new Date();
  res.json(await service.coverageOn(req.params.unitId, on));
});
