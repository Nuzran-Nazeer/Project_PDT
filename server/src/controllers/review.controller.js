const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/review.service");
const summaryChecks = require("../services/summaryCheck.service");
const results = require("../services/result.service");

// ⚠️ The signed-in id, never a parameter: no request shape reaches somebody else's result.
exports.getMyResult = asyncHandler(async (req, res) => {
  res.json(await results.resultFor(req.user.id));
});

exports.acknowledgeMyResult = asyncHandler(async (req, res) => {
  res.json(await results.acknowledgeResult(req.user.id));
});

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
