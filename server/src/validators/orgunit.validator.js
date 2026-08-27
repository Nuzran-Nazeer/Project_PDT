const AppError = require("../utils/AppError");
const { ORG_UNIT_TYPES } = require("../config/constants");

// Request-shape validation: fast-fail before touching the service or the database.
// Tree rules (one root, no unit inside itself) are about the OTHER units in the
// collection, so they stay in the service layer.
//
// The list comes from config/constants.js, never typed here, so the model and the
// validator cannot drift apart.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// An HTML select with nothing chosen posts "", and a cleared field posts null. Both
// mean "no parent", so they are normalised to null here and the service sees one value and
// the database is never asked to cast an empty string to an ObjectId.
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

// Discontinuing carries one field and it is required. See the controller for why it
// has no default, unlike a leaver's last working day.
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
