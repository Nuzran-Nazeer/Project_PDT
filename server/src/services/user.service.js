const User = require("../models/user.model");
const AppError = require("../utils/AppError");

// Business logic for users. Knows nothing about Express (no req/res here).

// Fields nobody may change after the record exists.
//   joinedDate  decides parGroup, and an appraisal group must never move
//   parGroup    same reason, one step further on
//   employeeId  the username is generated from its digits
//   username    generated, never typed
const IMMUTABLE_FIELDS = ["joinedDate", "parGroup", "employeeId", "username"];

// Fields HR may set when creating a record.
const CREATABLE_FIELDS = [
  "employeeId",
  "name",
  "email",
  "password",
  "roles",
  "designation",
  "level",
  "location",
  "joinedDate",
  "probationEndDate",
];

// Fields HR may change afterwards. Deliberately narrower than CREATABLE_FIELDS.
const UPDATABLE_FIELDS = [
  "name",
  "email",
  "roles",
  "designation",
  "level",
  "location",
  "probationEndDate",
  "status",
];

const pick = (source, fields) =>
  fields.reduce((out, key) => {
    if (source[key] !== undefined) out[key] = source[key];
    return out;
  }, {});

exports.createUser = async (data) => {
  const fields = pick(data, CREATABLE_FIELDS);

  const existing = await User.findOne({
    $or: [{ email: fields.email }, { employeeId: fields.employeeId }],
  });
  if (existing) throw new AppError("Email or employee ID already in use", 409);

  // HR creates the record; the employee sets their own password through an invite.
  // Until that story is built, HR may pass an initial password — if they do, the
  // account is usable straight away.
  if (!fields.password) fields.status = "invited";
  else fields.status = "active";

  return User.create(fields);
};

exports.listUsers = async (query = {}) => {
  const { status, role, jobFamily, location } = query;

  const filter = {};
  // Deactivated people are hidden unless asked for by name.
  filter.status = status || { $ne: "inactive" };
  if (role) filter.roles = role;
  if (jobFamily) filter.jobFamily = jobFamily;
  if (location) filter.location = location;

  const items = await User.find(filter).sort({ createdAt: -1 });
  return { items, total: items.length };
};

exports.getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found", 404);
  return user;
};

// Load, assign, save — NEVER findByIdAndUpdate.
//
// findByIdAndUpdate does not fire `save` hooks, so a password passed through it
// would be written to the database as plaintext, silently and with no error.
// This bug has already been caught once on this project.
exports.updateUser = async (id, data) => {
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found", 404);

  const attempted = IMMUTABLE_FIELDS.filter((f) => data[f] !== undefined);
  if (attempted.length) {
    throw new AppError(`These fields cannot be changed: ${attempted.join(", ")}`, 400);
  }

  const fields = pick(data, UPDATABLE_FIELDS);

  if (fields.email && fields.email !== user.email) {
    const clash = await User.findOne({ email: fields.email, _id: { $ne: id } });
    if (clash) throw new AppError("Email already in use", 409);
  }

  Object.assign(user, fields);
  await user.save();
  return user;
};

// Soft delete: the record stays, the account stops working.
// The record is someone's appraisal history — it is never removed.
exports.deactivateUser = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found", 404);

  user.status = "inactive";
  await user.save();
  return user;
};
