const AppError = require("../utils/AppError");
const { PAR_GROUPS, CYCLE_STAGES } = require("../config/constants");

// Request-shape checks only. Rules about other records or state live in the service.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const checkId = (value, field, errors) => {
  if (!value) return errors.push(`${field} is required`);
  if (!OBJECT_ID_RE.test(String(value))) {
    errors.push(`${field} is not a valid reference`);
  }
};

const checkDate = (value, field, errors) => {
  if (value === undefined || value === null || value === "") {
    return errors.push(`${field} is required`);
  }
  if (Number.isNaN(new Date(value).getTime())) {
    errors.push(`${field} is not a valid date`);
  }
};

const checkOneOf = (value, list, field, errors, { required = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${field} is required`);
    return;
  }
  if (!list.includes(value)) {
    errors.push(`${field} must be one of: ${list.join(", ")}`);
  }
};

const finish = (errors, next) => {
  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};

exports.validateCreateCycle = (req, res, next) => {
  const errors = [];
  checkOneOf(req.body.parGroup, PAR_GROUPS, "parGroup", errors);

  // No year range: inventing one would refuse a backfilled cycle for no stated reason.
  const year = Number(req.body.year);
  if (!req.body.year) errors.push("year is required");
  else if (!Number.isInteger(year)) errors.push("year must be a whole number");

  checkDate(req.body.startDate, "startDate", errors);
  checkDate(req.body.endDate, "endDate", errors);
  finish(errors, next);
};

exports.validateAdvanceCycle = (req, res, next) => {
  const errors = [];
  checkId(req.params.id, "id", errors);
  // `cancelled` is not a stage a cycle advances to; it has its own route.
  checkOneOf(req.body.status, CYCLE_STAGES, "status", errors);
  finish(errors, next);
};

exports.validateCancelCycle = (req, res, next) => {
  const errors = [];
  checkId(req.params.id, "id", errors);

  const reason = String(req.body.reason || "").trim();
  if (!reason) errors.push("reason is required");
  else if (reason.length < 5) errors.push("reason must say something");

  finish(errors, next);
};

exports.validateCycleId = (req, res, next) => {
  const errors = [];
  checkId(req.params.id, "id", errors);
  finish(errors, next);
};

exports.validateCycleQuery = (req, res, next) => {
  const errors = [];
  checkOneOf(req.query.parGroup, PAR_GROUPS, "parGroup", errors, { required: false });
  checkOneOf(req.query.status, [...CYCLE_STAGES, "cancelled"], "status", errors, {
    required: false,
  });
  if (req.query.year && !Number.isInteger(Number(req.query.year))) {
    errors.push("year must be a whole number");
  }
  finish(errors, next);
};
