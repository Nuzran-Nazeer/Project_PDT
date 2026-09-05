const AppError = require("../utils/AppError");

// Request-shape checks for projects and their assignments: are the references shaped
// like references, is a date present where one is required, is a name more than
// whitespace.
//
// Whether the dates make SENSE -- an assignment starting before its project, a team
// lead backdated across somebody else's term, a closing date that would strand an
// assignment -- are rules about the OTHER records, so they stay in the services. Same
// split as everywhere else. Coverage is not checked here either: it depends on which
// employee and which date, which only the service knows how to resolve.
//
// Both shapes share this file because they are one job recorded in two collections,
// and two copies of `checkId` drift.

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

// Projects

exports.validateCreateProject = (req, res, next) => {
  const errors = [];
  checkName(req.body.name, errors);
  checkId(req.body.leadId, "leadId", errors);
  checkDate(req.body.startDate, "startDate", errors);
  finish(errors, next);
};

// The last day the project operated. Required and with no default, for the reason
// discontinuing a unit has none: closing is a dated decision somebody made, and
// stamping today onto it invents the fact being recorded.
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

// ⚠️ EXACTLY THREE ACCEPTED SHAPES, and anything else is refused rather than read as
// the nearest one:
//   nothing          today
//   on               a single day
//   from AND to      a period
//
// Half a period, and `on` mixed with either half, are both ambiguous: they name two
// different questions in one request, and answering the one that happens to win would
// answer a question nobody asked.
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

// Assignments

exports.validateCreateAssignment = (req, res, next) => {
  const errors = [];
  checkId(req.body.projectId, "projectId", errors);
  checkId(req.body.userId, "userId", errors);
  checkDate(req.body.from, "from", errors);
  // Optional: present only when recording a stint whose end is already known.
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
