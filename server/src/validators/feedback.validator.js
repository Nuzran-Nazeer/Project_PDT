const AppError = require("../utils/AppError");

// Request-SHAPE checks only. Whether an answer is allowed on this form, whether a score
// needs evidence, and whether the record is still inside its edit window are rules about
// the record and its competency list, so they live in the service.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const finish = (errors, next) => {
  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};

const checkId = (value, field, errors) => {
  if (!value) return errors.push(`${field} is required`);
  if (!OBJECT_ID_RE.test(String(value))) errors.push(`${field} is not a valid reference`);
};

exports.validateFeedbackId = (req, res, next) => {
  const errors = [];
  checkId(req.params.id, "id", errors);
  finish(errors, next);
};

exports.validateReviewId = (req, res, next) => {
  const errors = [];
  checkId(req.params.reviewId, "reviewId", errors);
  finish(errors, next);
};

exports.validateAnswers = (req, res, next) => {
  const errors = [];
  const { ratings, freeText } = req.body || {};

  if (ratings !== undefined) {
    if (!Array.isArray(ratings)) {
      errors.push("ratings must be a list");
    } else {
      ratings.forEach((row, i) => {
        const at = `ratings[${i}]`;
        if (!row || typeof row !== "object")
          return errors.push(`${at} must be an object`);
        if (!row.competencyKey) errors.push(`${at}.competencyKey is required`);

        if (row.score !== undefined && row.score !== null) {
          const score = Number(row.score);
          if (!Number.isInteger(score) || score < 1 || score > 5) {
            errors.push(`${at}.score must be a whole number from 1 to 5`);
          }
        }
        if (row.evidence !== undefined && row.evidence !== null) {
          if (typeof row.evidence !== "string")
            errors.push(`${at}.evidence must be text`);
        }
        if (row.notObserved !== undefined && typeof row.notObserved !== "boolean") {
          errors.push(`${at}.notObserved must be true or false`);
        }
      });
    }
  }

  if (freeText !== undefined) {
    if (typeof freeText !== "object" || freeText === null) {
      errors.push("freeText must be an object");
    } else {
      for (const field of ["strengths", "development"]) {
        const value = freeText[field];
        if (value !== undefined && value !== null && typeof value !== "string") {
          errors.push(`freeText.${field} must be text`);
        }
      }
    }
  }

  finish(errors, next);
};
