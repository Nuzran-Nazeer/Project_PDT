const AppError = require("../utils/AppError");
const {
  GRANTABLE_ROLES,
  DERIVED_ROLES,
  USER_STATUS,
  LOCATIONS,
  DESIGNATION_NAMES,
  EMPLOYEE_ID_PATTERN,
  MIN_PASSWORD_LENGTH,
} = require("../config/constants");

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Request-shape validation: fast-fail before touching the service or the database.
// Business rules (duplicate email, immutable fields) stay in the service layer.
//
// The lists come from config/constants.js, never from the model, so the model and
// the validator cannot drift apart, and neither can be renamed without the other.

const checkRoles = (roles, errors) => {
  if (roles === undefined) return;
  if (!Array.isArray(roles)) {
    errors.push("roles must be a list");
    return;
  }
  roles.forEach((r) => {
    if (DERIVED_ROLES.includes(r)) {
      errors.push(`${r} is derived from the org structure and cannot be granted`);
    } else if (!GRANTABLE_ROLES.includes(r)) {
      errors.push(`roles must each be one of: ${GRANTABLE_ROLES.join(", ")}`);
    }
  });
};

exports.validateCreateUser = (req, res, next) => {
  const { employeeId, name, email, password, roles, designation, location, joinedDate } =
    req.body;
  const errors = [];

  if (!employeeId || !String(employeeId).trim()) errors.push("employeeId is required");
  else if (!EMPLOYEE_ID_PATTERN.test(String(employeeId).toUpperCase().trim()))
    errors.push("employeeId must look like ALT-0241");

  if (!name || !name.trim()) errors.push("name is required");

  if (!email || !email.trim()) errors.push("email is required");
  else if (!EMAIL_RE.test(email)) errors.push("email is invalid");

  if (!joinedDate) errors.push("joinedDate is required");
  else if (Number.isNaN(Date.parse(joinedDate))) errors.push("joinedDate is not a date");

  // Optional at creation: HR may leave it for the employee to set via invite.
  if (password !== undefined && String(password).length < MIN_PASSWORD_LENGTH)
    errors.push(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);

  if (designation && !DESIGNATION_NAMES.includes(designation))
    errors.push(`designation is not recognised`);

  if (location && !LOCATIONS.includes(location))
    errors.push(`location must be one of: ${LOCATIONS.join(", ")}`);

  checkRoles(roles, errors);

  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};

exports.validateUpdateUser = (req, res, next) => {
  const { email, roles, designation, location, status } = req.body;
  const errors = [];

  if (email !== undefined && !EMAIL_RE.test(email)) errors.push("email is invalid");

  if (designation !== undefined && !DESIGNATION_NAMES.includes(designation))
    errors.push("designation is not recognised");

  if (location !== undefined && !LOCATIONS.includes(location))
    errors.push(`location must be one of: ${LOCATIONS.join(", ")}`);

  if (status !== undefined && !USER_STATUS.includes(status))
    errors.push(`status must be one of: ${USER_STATUS.join(", ")}`);

  checkRoles(roles, errors);

  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};
