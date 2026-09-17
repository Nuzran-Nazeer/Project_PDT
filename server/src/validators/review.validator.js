const AppError = require("../utils/AppError");

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

exports.validateReviewId = (req, res, next) => {
  if (!OBJECT_ID_RE.test(String(req.params.id || ""))) {
    return next(new AppError("id is not a valid reference", 400));
  }
  next();
};
