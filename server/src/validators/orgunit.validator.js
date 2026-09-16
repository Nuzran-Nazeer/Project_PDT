const AppError = require("../utils/AppError");
const { ORG_UNIT_TYPES } = require("../config/constants");

// Request-shape checks only. Rules about other records or state live in the service.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// An empty select posts "" and a cleared field posts null; both mean "no parent".
const normaliseParent = (req) => {
  const raw = req.body.parentUnitId;
  if (raw === "" || raw === null) req.body.parentUnitId = null;
};

const checkParent = (parentUnitId, errors) => {
  if (parentUnitId === undefined || parentUnitId === null) return;
  if (!OBJECT_ID_RE.test(String(parentUnitId))) {
    errors.push("parentUnitId is not a valid unit reference");
  }
};

exports.validateCreateUnit = (req, res, next) => {
  normaliseParent(req);
  const { name, type, parentUnitId } = req.body;
  const errors = [];

  if (!name || !String(name).trim()) errors.push("name is required");

  if (!type) errors.push("type is required");
  else if (!ORG_UNIT_TYPES.includes(type))
    errors.push(`type must be one of: ${ORG_UNIT_TYPES.join(", ")}`);

  checkParent(parentUnitId, errors);

  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};

exports.validateDiscontinueUnit = (req, res, next) => {
  const { lastDay } = req.body;
  const errors = [];

  if (lastDay === undefined || lastDay === null || lastDay === "") {
    errors.push("lastDay is required");
  } else if (Number.isNaN(new Date(lastDay).getTime())) {
    errors.push("lastDay is not a valid date");
  }

  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};

exports.validateUpdateUnit = (req, res, next) => {
  normaliseParent(req);
  const { name, type, parentUnitId } = req.body;
  const errors = [];

  if (name !== undefined && !String(name).trim()) errors.push("name cannot be empty");

  if (type !== undefined && !ORG_UNIT_TYPES.includes(type))
    errors.push(`type must be one of: ${ORG_UNIT_TYPES.join(", ")}`);

  checkParent(parentUnitId, errors);

  if (errors.length) return next(new AppError(errors.join("; "), 400));
  next();
};
