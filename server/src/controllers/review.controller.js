const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/review.service");
const summaryChecks = require("../services/summaryCheck.service");

exports.publishReview = asyncHandler(async (req, res) => {
  res.json(await service.publishReview(req.params.id));
});

// The whole account is passed: coverage is a relationship the service derives.
exports.listSummaryChecks = asyncHandler(async (req, res) => {
  res.json(await summaryChecks.listOwed(req.user));
});

exports.getSummaryCheck = asyncHandler(async (req, res) => {
  res.json(await summaryChecks.checkScreenFor(req.params.id, req.user));
});

exports.clearSummary = asyncHandler(async (req, res) => {
  res.json(await summaryChecks.clearSummary(req.params.id, req.user));
});

exports.sendBackSummary = asyncHandler(async (req, res) => {
  res.json(await summaryChecks.sendBack(req.params.id, req.user, req.body.reason));
});
