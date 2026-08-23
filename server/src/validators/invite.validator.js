const AppError = require("../utils/AppError");
const { MIN_PASSWORD_LENGTH } = require("../config/constants");

// Request-shape validation for the PUBLIC activation endpoint. It is the one place
// in the system an unauthenticated stranger can post to, so it checks the shape
// before anything touches the database.
//
// It deliberately does NOT check whether the code looks like a 64-character hex
// string. A malformed code and an unknown code must fail identically — a shape
// complaint would tell someone probing the endpoint what a real code looks like.
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
