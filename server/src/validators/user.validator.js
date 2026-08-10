const AppError = require("../utils/AppError");
const { ROLES } = require("../models/user.model");

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Request-shape validation (fast-fail before touching the service/DB).
// Business rules (e.g. duplicate email) stay in the service layer.
exports.validateCreateUser = (req, res, next) => {
  const { name, email, role } = req.body;
  const errors = [];

  if (!name || !name.trim()) errors.push("name is required");
  if (!email || !email.trim()) errors.push("email is required");
  else if (!EMAIL_RE.test(email)) errors.push("email is invalid");
  if (role && !ROLES.includes(role))
    errors.push(`role must be one of: ${ROLES.join(", ")}`);

  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};
