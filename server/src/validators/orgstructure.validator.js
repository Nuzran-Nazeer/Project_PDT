const AppError = require("../utils/AppError");
const { HR_COVERAGE_ROLES } = require("../config/constants");

// Request-shape checks only. Rules about other records or state live in the service.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const checkId = (value, field, errors, { required = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${field} is required`);
    return;
  }
  if (!OBJECT_ID_RE.test(String(value))) {
    errors.push(`${field} is not a valid reference`);
  }
};

const checkDate = (value, field, errors, { required = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${field} is required`);
    return;
  }
  if (Number.isNaN(new Date(value).getTime())) {
    errors.push(`${field} is not a valid date`);
  }
};

const checkEnum = (value, field, allowed, errors, { required = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${field} is required`);
    return;
  }
  if (!allowed.includes(value)) {
    errors.push(`${field} must be one of: ${allowed.join(", ")}`);
  }
};

const finish = (errors, next) => {
  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};

exports.validateCreateMembership = (req, res, next) => {
  const errors = [];
  checkId(req.body.userId, "userId", errors);
  checkId(req.body.unitId, "unitId", errors);
  checkDate(req.body.from, "from", errors);
  checkDate(req.body.to, "to", errors, { required: false });
  finish(errors, next);
};

exports.validateTransfer = (req, res, next) => {
  const errors = [];
  checkId(req.body.userId, "userId", errors);
  checkId(req.body.unitId, "unitId", errors);
  checkDate(req.body.from, "from", errors);
  finish(errors, next);
};

exports.validateAppointLead = (req, res, next) => {
  const errors = [];
  checkId(req.body.unitId, "unitId", errors);
  checkId(req.body.userId, "userId", errors);
  checkDate(req.body.from, "from", errors);
  finish(errors, next);
};

exports.validateClose = (req, res, next) => {
  const errors = [];
  checkDate(req.body.to, "to", errors);
  finish(errors, next);
};

// A malformed filter must not reach the database as a cast error, which surfaces as a 500.
exports.validateHistoryQuery = (req, res, next) => {
  const errors = [];
  checkId(req.query.userId, "userId", errors, { required: false });
  checkId(req.query.unitId, "unitId", errors, { required: false });
  checkDate(req.query.on, "on", errors, { required: false });
  finish(errors, next);
};

exports.validateReportingLineQuery = (req, res, next) => {
  const errors = [];
  checkId(req.params.userId, "userId", errors);
  checkDate(req.query.on, "on", errors, { required: false });
  finish(errors, next);
};

exports.validateAssignCoverage = (req, res, next) => {
  const errors = [];
  checkId(req.body.unitId, "unitId", errors);
  checkId(req.body.userId, "userId", errors);
  checkEnum(req.body.role, "role", HR_COVERAGE_ROLES, errors);
  checkDate(req.body.from, "from", errors);
  finish(errors, next);
};

exports.validateCoverageHistoryQuery = (req, res, next) => {
  const errors = [];
  checkId(req.query.userId, "userId", errors, { required: false });
  checkId(req.query.unitId, "unitId", errors, { required: false });
  checkDate(req.query.on, "on", errors, { required: false });
  finish(errors, next);
};

exports.validateEffectiveCoverageQuery = (req, res, next) => {
  const errors = [];
  checkId(req.params.unitId, "unitId", errors);
  checkDate(req.query.on, "on", errors, { required: false });
  finish(errors, next);
};
