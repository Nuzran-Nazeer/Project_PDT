const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/plan.service");

// The whole account is passed: whether somebody may write a plan is a relationship the
// service derives, never a role on the request.

exports.listTeamPlans = asyncHandler(async (req, res) => {
  res.json(await service.teamPlans(req.user.id));
});

exports.startPlan = asyncHandler(async (req, res) => {
  res.status(201).json(await service.startPlanFromReview(req.body.reviewId, req.user));
});

exports.getPlan = asyncHandler(async (req, res) => {
  res.json(await service.getPlanForSupervisor(req.params.id, req.user));
});

exports.addAction = asyncHandler(async (req, res) => {
  res.status(201).json(await service.addAction(req.params.id, req.user, req.body));
});

exports.editAction = asyncHandler(async (req, res) => {
  res.json(
    await service.editAction(req.params.id, req.params.actionId, req.user, req.body),
  );
});

exports.removeAction = asyncHandler(async (req, res) => {
  res.json(await service.removeAction(req.params.id, req.params.actionId, req.user));
});

exports.sharePlan = asyncHandler(async (req, res) => {
  res.json(await service.sharePlan(req.params.id, req.user));
});
