const AppError = require("../utils/AppError");
const { LIST_CHANGE_TYPES } = require("../config/constants");

// Request-SHAPE checks only. Whether a person may be added or removed depends on the list and
// the reporting line, so that lives in the service.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const finish = (errors, next) => {
  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};

const checkId = (value, field, errors) => {
  if (!value) return errors.push(`${field} is required`);
  if (!OBJECT_ID_RE.test(String(value))) errors.push(`${field} is not a valid reference`);
};

exports.validateReviewId = (req, res, next) => {
  const errors = [];
  checkId(req.params.reviewId, "reviewId", errors);
  finish(errors, next);
};

exports.validateChangeId = (req, res, next) => {
  const errors = [];
  checkId(req.params.changeId, "changeId", errors);
  finish(errors, next);
};

exports.validateCycleQuery = (req, res, next) => {
  const errors = [];
  checkId(req.query.cycleId, "cycleId", errors);
  finish(errors, next);
};

exports.validateAddableQuery = (req, res, next) => {
  const errors = [];
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) errors.push("q must be at least 2 characters");
  if (q.length > 60) errors.push("q must be at most 60 characters");
  finish(errors, next);
};

exports.validateConfirm = (req, res, next) => {
  const errors = [];
  const { changes } = req.body || {};

  if (changes !== undefined) {
    if (!Array.isArray(changes)) {
      errors.push("changes must be a list");
    } else {
      changes.forEach((change, i) => {
        const at = `changes[${i}]`;
        if (!change || typeof change !== "object")
          return errors.push(`${at} must be an object`);
        if (!LIST_CHANGE_TYPES.includes(change.type)) {
          errors.push(`${at}.type must be one of ${LIST_CHANGE_TYPES.join(", ")}`);
        }
        checkId(change.userId, `${at}.userId`, errors);
        if (typeof change.reason !== "string" || !change.reason.trim()) {
          errors.push(`${at}.reason is required`);
        }
      });
    }
  }

  finish(errors, next);
};

exports.validateDecision = (req, res, next) => {
  const errors = [];
  if (typeof req.body?.approve !== "boolean")
    errors.push("approve must be true or false");
  finish(errors, next);
};

exports.validateDraw = (req, res, next) => {
  const errors = [];
  const { acknowledged } = req.body || {};
  if (acknowledged !== undefined && typeof acknowledged !== "boolean") {
    errors.push("acknowledged must be true or false");
  }
  finish(errors, next);
};
