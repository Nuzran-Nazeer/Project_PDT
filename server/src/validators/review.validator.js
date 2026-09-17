const AppError = require("../utils/AppError");

// Request-shape checks only. Rules about other records or state live in the service.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

exports.validateReviewId = (req, res, next) => {
  if (!OBJECT_ID_RE.test(String(req.params.id || ""))) {
    return next(new AppError("id is not a valid reference", 400));
  }
  next();
};

exports.validateSendBack = (req, res, next) => {
  const reason = req.body?.reason;
  if (typeof reason !== "string" || !reason.trim()) {
    return next(new AppError("A reason is required to send a summary back", 400));
  }
  req.body.reason = reason.trim();
  next();
};
