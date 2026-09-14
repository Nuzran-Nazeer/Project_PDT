const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/reviewerList.service");

// The whole account is passed rather than the id: who may act is a relationship or a
// coverage the service has to derive. Every actor comes from the TOKEN, never the body.

exports.listForCycle = asyncHandler(async (req, res) => {
  res.json(await service.listsForCycle(req.query.cycleId, req.user));
});

exports.listForTeam = asyncHandler(async (req, res) => {
  res.json(await service.listsForTeam(req.user));
});

exports.getList = asyncHandler(async (req, res) => {
  res.json(await service.listFor(req.params.reviewId, req.user));
});

exports.addable = asyncHandler(async (req, res) => {
  res.json(await service.addableFor(req.params.reviewId, req.user, req.query.q));
});

exports.confirm = asyncHandler(async (req, res) => {
  res.json(await service.confirmList(req.params.reviewId, req.user, req.body));
});

exports.decide = asyncHandler(async (req, res) => {
  res.json(
    await service.decideChange(
      req.params.reviewId,
      req.params.changeId,
      req.user,
      req.body,
    ),
  );
});

exports.draw = asyncHandler(async (req, res) => {
  res.json(await service.drawReviewers(req.params.reviewId, req.user, req.body));
});
