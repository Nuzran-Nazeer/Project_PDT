const AppError = require("../utils/AppError");

// Request-shape checks only. Who may close a flag, and whether this one is theirs, is the
// service's business.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

exports.validateFlagReview = (req, res, next) => {
  const errors = [];

  if (!OBJECT_ID_RE.test(String(req.params.id || ""))) errors.push("id is not a valid reference");

  const { note } = req.body || {};
  if (typeof note !== "string" || !note.trim()) {
    errors.push("A note is required before a flag is marked reviewed");
  }

  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};
