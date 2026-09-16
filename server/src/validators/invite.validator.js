const AppError = require("../utils/AppError");
const { MIN_PASSWORD_LENGTH } = require("../config/constants");

// ⚠️ Public endpoint. The code's shape is deliberately not checked: a malformed code and
// an unknown code must fail identically, or a probe learns what a real one looks like.
exports.validateActivate = (req, res, next) => {
  const { code, password } = req.body;
  const errors = [];

  if (!code || !String(code).trim()) errors.push("code is required");

  if (!password) errors.push("password is required");
  else if (String(password).length < MIN_PASSWORD_LENGTH)
    errors.push(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);

  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};
