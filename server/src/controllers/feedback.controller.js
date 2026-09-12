const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/feedback.service");

// ⚠️ Every reviewer-facing handler reads the id from the TOKEN, never from the URL or
// the body. There is no request shape that opens somebody else's feedback.

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

// The signed-in person's own assessment. It takes no id at all: the cycle comes off
// their own appraisal group and the review off their own record, so the narrow answer
// is the only one these can give.
exports.getSelfAssessment = asyncHandler(async (req, res) => {
  res.json(await service.selfAssessmentFor(req.user.id));
});

exports.saveSelfDraft = asyncHandler(async (req, res) => {
  res.json(await service.saveSelfDraft(req.user.id, req.body));
});

exports.submitSelf = asyncHandler(async (req, res) => {
  res.json(await service.submitSelf(req.user.id, req.body));
});

// The one read that serves somebody else's answers. It is the supervisor's only route
// to the raw text, and the strip function has already run by the time it gets here.
exports.getCollected = asyncHandler(async (req, res) => {
  res.json(await service.collectedFor(req.params.reviewId, req.user));
});
