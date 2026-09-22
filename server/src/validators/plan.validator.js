const AppError = require("../utils/AppError");

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
