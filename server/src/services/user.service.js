const User = require("../models/user.model");
const UnitMembership = require("../models/unitmembership.model");
const UnitLead = require("../models/unitlead.model");
const AppError = require("../utils/AppError");
const { toDay, dayAfter, assertOrderedRange } = require("../utils/dateRange");

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

  // HR creates the record; the employee sets their own password through an invite. An
  // initial password from HR still works, and makes the account usable at once.
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

// Load, assign, save. NEVER findByIdAndUpdate.
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

// Soft delete: the record stays because it is someone's appraisal history, and the
// account stops working. It also CLOSES the dated records that depend on the person,
// because an open dated record means "this is still true today", and leaving a leaver
// open makes the reporting line assert something false on a screen.
//
// This cascades where discontinuing a unit REFUSES, which is not an inconsistency:
// closing a unit is a decision that can be made to happen in the right order, while a
// person leaving is a fact that already happened.
//
// `lastWorkingDay` defaults to today but is editable, because HR processes leavers
// after they have gone: peer eligibility is four continuous months, so a fortnight of
// phantom service can flip whether someone was eligible to review a colleague.
exports.deactivateUser = async (id, lastWorkingDay) => {
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found", 404);

  const finalDay = toDay(lastWorkingDay || new Date(), "lastWorkingDay");
  const closesOn = dayAfter(finalDay);
  const warnings = [];

  const membership = await UnitMembership.findOne({ userId: user._id, to: null });
  if (membership) {
    assertOrderedRange(membership.from, closesOn);
    membership.to = closesOn;
    await membership.save();
  }

  // A loop, not a findOne: one person leading several units at once is ordinary in a
  // company this size.
  const terms = await UnitLead.find({ userId: user._id, to: null }).populate(
    "unitId",
    "name",
  );

  for (const term of terms) {
    assertOrderedRange(term.from, closesOn);
    term.to = closesOn;
    await term.save();

    // A unit holds at most one lead, so closing a term always leaves it vacant. This
    // WARNS rather than refusing, which is safe because the reporting line resolves
    // upward: the unit degrades to reporting one level higher.
    warnings.push(
      `${(term.unitId && term.unitId.name) || "A unit"} now has no lead. Its people report to the unit above until someone is appointed.`,
    );
  }

  user.status = "inactive";
  await user.save();

  // Reactivating is an ordinary status edit through updateUser and deliberately does
  // NOT reopen the membership closed above: someone who comes back returns with no
  // unit. Reopening would claim continuous membership across a gap that really
  // happened, and guess at a unit that may since have been reorganised.
  return { user, warnings };
};
