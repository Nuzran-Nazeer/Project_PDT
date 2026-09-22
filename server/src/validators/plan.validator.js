const AppError = require("../utils/AppError");
const { CHECK_IN_OUTCOMES, PLAN_ACTION_OPEN_STATUS } = require("../config/constants");

// Request-shape checks only. Whether the review is published, whether the actor supervises
// the employee today and whether a competency belongs to that review are decided in the service.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const validateId = (param, label) => (req, res, next) => {
  if (!OBJECT_ID_RE.test(String(req.params[param] || ""))) {
    return next(new AppError(`${label} is not a valid reference`, 400));
  }
  next();
};

exports.validatePlanId = validateId("id", "id");
exports.validateActionId = validateId("actionId", "actionId");
exports.validateUserId = validateId("userId", "userId");

exports.validateReviewIdBody = (req, res, next) => {
  if (!OBJECT_ID_RE.test(String(req.body?.reviewId || ""))) {
    return next(new AppError("reviewId is not a valid reference", 400));
  }
  next();
};

exports.validateNote = (req, res, next) => {
  if (!String(req.body?.note || "").trim()) {
    return next(new AppError("A progress note cannot be empty", 400));
  }
  next();
};

// ⚠️ Only that `ownerId` is a reference. Whether it is the employee or the supervisor is a
// rule about two other records, so it belongs in the service.
exports.validateAction = (req, res, next) => {
  if (req.body?.ownerId && !OBJECT_ID_RE.test(String(req.body.ownerId))) {
    return next(new AppError("ownerId is not a valid reference", 400));
  }
  next();
};

// ⚠️ Shape only. Whether the plan is active, whether the date is in the future and whether it
// falls before the employee agreed to the plan are all rules about the record, so the service
// decides them.
exports.validateCheckIn = (req, res, next) => {
  const { outcome, at } = req.body || {};

  if (outcome !== undefined && !CHECK_IN_OUTCOMES.includes(outcome)) {
    return next(new AppError("That is not a check-in outcome", 400));
  }

  if (at !== undefined && Number.isNaN(new Date(at).getTime())) {
    return next(new AppError("at is not a valid date", 400));
  }

  next();
};

// `overdue` and `carried_forward` are absent on purpose: one is worked out when a plan is
// read and the other is written when a plan closes. Neither is a state anyone moves to.
exports.validateActionStatus = (req, res, next) => {
  if (!PLAN_ACTION_OPEN_STATUS.includes(req.body?.status)) {
    return next(new AppError("That is not a state an action can be moved to", 400));
  }
  next();
};
