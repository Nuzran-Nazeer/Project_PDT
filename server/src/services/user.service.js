const User = require("../models/user.model");
const UnitMembership = require("../models/unitmembership.model");
const UnitLead = require("../models/unitlead.model");
const HrCoverage = require("../models/hrcoverage.model");
const AppError = require("../utils/AppError");
const { toDay, dayAfter, assertOrderedRange } = require("../utils/dateRange");

// joinedDate decides parGroup and an appraisal group must never move; the username is
// generated from the employeeId.
const IMMUTABLE_FIELDS = ["joinedDate", "parGroup", "employeeId", "username"];

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

  // No password means the employee sets one through an invite.
  if (!fields.password) fields.status = "invited";
  else fields.status = "active";

  return User.create(fields);
};

exports.listUsers = async (query = {}) => {
  const { status, role, jobFamily, location } = query;

  const filter = {};
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

// ⚠️ Load, assign, save. Never findByIdAndUpdate: it skips the save hooks, so a password
// would be written as plaintext with no error.
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

// Soft delete. Closes the person's open dated records too: an open record means "still
// true today". `lastWorkingDay` is editable because HR processes leavers after they have gone.
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

  // One person can lead several units at once.
  const terms = await UnitLead.find({ userId: user._id, to: null }).populate(
    "unitId",
    "name",
  );

  for (const term of terms) {
    assertOrderedRange(term.from, closesOn);
    term.to = closesOn;
    await term.save();

    warnings.push(
      `${(term.unitId && term.unitId.name) || "A unit"} now has no lead. Its people report to the unit above until someone is appointed.`,
    );
  }

  const coverageRecords = await HrCoverage.find({ userId: user._id, to: null }).populate(
    "unitId",
    "name",
  );

  // ⚠️ Every date is checked before the first save, so a bad one cannot leave half closed.
  for (const record of coverageRecords) {
    assertOrderedRange(record.from, closesOn);
  }

  for (const record of coverageRecords) {
    record.to = closesOn;
    await record.save();

    // ⚠️ Any direct record still open blocks inheritance, so the wording depends on what
    // is left. This leaver's own records are excluded: the unclosed ones are going too.
    const remaining = await HrCoverage.findOne({
      unitId: record.unitId?._id || record.unitId,
      userId: { $ne: user._id },
      to: null,
    });

    const unitName = (record.unitId && record.unitId.name) || "A unit";

    warnings.push(
      remaining
        ? `${unitName} now has no ${record.role} HR officer. Its ${remaining.role} still covers it directly.`
        : `${unitName} now has no ${record.role} HR officer. It falls back to coverage from the unit above until someone is appointed.`,
    );
  }

  user.status = "inactive";
  await user.save();

  // Reactivating (a status edit through updateUser) never reopens the membership closed here.
  return { user, warnings };
};
