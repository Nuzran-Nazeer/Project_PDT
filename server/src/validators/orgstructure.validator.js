const AppError = require("../utils/AppError");

// Request-shape checks for the dated collections: are the references shaped like
// references, and is a date present where one is required.
//
// Whether the dates make SENSE -- one unit at a time, a lead who sits in the parent
// unit, a move dated before the stint it ends -- are rules about the other records
// in the collection, so they stay in the services. Same split as everywhere else.
//
// Both dated collections share this file because their request shapes are identical
// down to the field names, and two copies would drift.

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

// Only the SHAPE is checked here. A date that parses but is nonsense in context --
// an end before a start -- is caught in the service, which is the only layer that
// knows what it is being compared against.
const checkDate = (value, field, errors, { required = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${field} is required`);
    return;
  }
  if (Number.isNaN(new Date(value).getTime())) {
    errors.push(`${field} is not a valid date`);
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
  // Optional: present only when backfilling a stint that is already over.
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

// Query filters are all optional, but a malformed one must not reach the database
// as a cast error -- that surfaces as a 500 for what is really a bad request.
exports.validateHistoryQuery = (req, res, next) => {
  const errors = [];
  checkId(req.query.userId, "userId", errors, { required: false });
  checkId(req.query.unitId, "unitId", errors, { required: false });
  checkDate(req.query.on, "on", errors, { required: false });
  finish(errors, next);
};

// The reporting line takes the person in the path and the date in the query. `on` is
// optional and means today when it is left off; a malformed one is still refused,
// because silently reading a bad date as today would answer a question nobody asked.
exports.validateReportingLineQuery = (req, res, next) => {
  const errors = [];
  checkId(req.params.userId, "userId", errors);
  checkDate(req.query.on, "on", errors, { required: false });
  finish(errors, next);
};
