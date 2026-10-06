const asyncHandler = require("../utils/asyncHandler");
const reports = require("../services/report.service");

exports.ratingDistribution = asyncHandler(async (req, res) => {
  res.json(await reports.ratingDistribution(req.user, { cycleId: req.query.cycle }));
});

exports.planProgress = asyncHandler(async (req, res) => {
  res.json(await reports.planProgress(req.user, { cycleId: req.query.cycle }));
});

exports.auditCounts = asyncHandler(async (req, res) => {
  res.json(await reports.auditCounts(req.user));
});
