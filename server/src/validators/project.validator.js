const AppError = require("../utils/AppError");

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

const checkName = (value, errors) => {
  if (!value || !String(value).trim()) errors.push("name is required");
};

const finish = (errors, next) => {
  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};

exports.validateCreateProject = (req, res, next) => {
  const errors = [];
  checkName(req.body.name, errors);
  checkId(req.body.leadId, "leadId", errors);
  checkDate(req.body.startDate, "startDate", errors);
  finish(errors, next);
};

// No default: stamping today onto a closing would invent the fact being recorded.
exports.validateCloseProject = (req, res, next) => {
  const errors = [];
  checkId(req.params.id, "id", errors);
  checkDate(req.body.lastDay, "lastDay", errors);
  finish(errors, next);
};

exports.validateProjectId = (req, res, next) => {
  const errors = [];
  checkId(req.params.id, "id", errors);
  finish(errors, next);
};

exports.validateProjectQuery = (req, res, next) => {
  const errors = [];
  checkDate(req.query.on, "on", errors, { required: false });
  checkId(req.query.leadId, "leadId", errors, { required: false });
  finish(errors, next);
};

// ⚠️ Exactly three shapes: nothing (today), `on` (a day), `from` and `to` (a period).
// Half a period, or `on` mixed with either half, is refused rather than guessed.
exports.validateTeamQuery = (req, res, next) => {
  const errors = [];
  checkId(req.params.id, "id", errors);
  checkDate(req.query.from, "from", errors, { required: false });
  checkDate(req.query.to, "to", errors, { required: false });
  checkDate(req.query.on, "on", errors, { required: false });

  if (Boolean(req.query.from) !== Boolean(req.query.to)) {
    errors.push("from and to must be given together");
  }

  if (req.query.on && (req.query.from || req.query.to)) {
    errors.push("on cannot be combined with from or to");
  }

  finish(errors, next);
};

exports.validateCreateAssignment = (req, res, next) => {
  const errors = [];
  checkId(req.body.projectId, "projectId", errors);
  checkId(req.body.userId, "userId", errors);
  checkDate(req.body.from, "from", errors);
  checkDate(req.body.to, "to", errors, { required: false });
  finish(errors, next);
};

exports.validateCloseAssignment = (req, res, next) => {
  const errors = [];
  checkId(req.params.id, "id", errors);
  checkDate(req.body.to, "to", errors);
  finish(errors, next);
};

exports.validateTeamLead = (req, res, next) => {
  const errors = [];
  checkId(req.params.id, "id", errors);
  checkDate(req.body.from, "from", errors);
  finish(errors, next);
};

exports.validateAssignmentQuery = (req, res, next) => {
  const errors = [];
  checkId(req.query.projectId, "projectId", errors, { required: false });
  checkId(req.query.userId, "userId", errors, { required: false });
  checkDate(req.query.on, "on", errors, { required: false });
  finish(errors, next);
};
