const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/feedback.service");

// ⚠️ Every reviewer-facing handler reads the id from the token, never the URL or the body.

exports.listOwed = asyncHandler(async (req, res) => {
  res.json(await service.owedBy(req.user.id));
});

exports.getOwed = asyncHandler(async (req, res) => {
  res.json(await service.getForReviewer(req.params.id, req.user.id));
});

exports.saveDraft = asyncHandler(async (req, res) => {
  res.json(await service.saveDraft(req.params.id, req.user.id, req.body));
});

exports.submit = asyncHandler(async (req, res) => {
  res.json(await service.submit(req.params.id, req.user.id, req.body));
});

exports.getSelfAssessment = asyncHandler(async (req, res) => {
  res.json(await service.selfAssessmentFor(req.user.id));
});

exports.saveSelfDraft = asyncHandler(async (req, res) => {
  res.json(await service.saveSelfDraft(req.user.id, req.body));
});

exports.submitSelf = asyncHandler(async (req, res) => {
  res.json(await service.submitSelf(req.user.id, req.body));
});

// The supervisor's only route to the raw text; the strip function has already run.
exports.getCollected = asyncHandler(async (req, res) => {
  res.json(await service.collectedFor(req.params.reviewId, req.user));
});

exports.getAssessment = asyncHandler(async (req, res) => {
  res.json(await service.assessmentFor(req.params.reviewId, req.user));
});

// The whole account is passed: the gate is a relationship the service derives.
exports.getSupervisorReview = asyncHandler(async (req, res) => {
  res.json(await service.supervisorReviewFor(req.params.reviewId, req.user));
});

exports.saveSupervisorDraft = asyncHandler(async (req, res) => {
  res.json(await service.saveSupervisorDraft(req.params.reviewId, req.user, req.body));
});

exports.submitSupervisorReview = asyncHandler(async (req, res) => {
  res.json(await service.submitSupervisorReview(req.params.reviewId, req.user, req.body));
});
