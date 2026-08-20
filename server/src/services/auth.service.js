const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/token");

// Everything a token carries. Kept in one place so no route invents its own shape.
const tokenFor = (user) => signToken({ id: user._id, roles: user.roles });

// ---------------------------------------------------------------------------
// ⚠️ register is KNOWINGLY OPEN and does not belong in the finished system.
// It reads `roles` from the request body, so anyone can create themselves an `hr`
// account. It survives only because it is currently the one way to bootstrap an
// account on an empty database. See PDT-BUILD-DECISIONS.md § B4 (DEFERRED) and
// PDT-CODEBASE-WALKTHROUGH.md § 4.1.
// ---------------------------------------------------------------------------
exports.register = async (data) => {
  const {
    employeeId,
    name,
    email,
    password,
    roles,
    designation,
    level,
    location,
    joinedDate,
    probationEndDate,
  } = data;

  if (!password) throw new AppError("Password is required", 400);

  const existing = await User.findOne({ $or: [{ email }, { employeeId }] });
  if (existing) throw new AppError("Email or employee ID already in use", 409);

  // Self-registration produces a usable account immediately — there is no invite to
  // complete. HR-created records start as `invited` instead.
  const user = await User.create({
    employeeId,
    name,
    email,
    password,
    roles,
    designation,
    level,
    location,
    joinedDate,
    probationEndDate,
    status: "active",
  });

  return { user, token: tokenFor(user) };
};

exports.login = async ({ identifier, email, username, password }) => {
  // Login accepts either the email address or the generated username.
  const login = identifier || email || username;
  if (!login || !password) {
    throw new AppError("Email or username, and password, are required", 400);
  }

  const key = String(login).toLowerCase().trim();
  const user = await User.findOne({
    $or: [{ email: key }, { username: key }],
  }).select("+password"); // the only query allowed to ask for the password back

  // ONE message for "no such account", "wrong password" and "account disabled".
  // Distinct messages would let anyone probe which addresses belong to staff —
  // which matters more than usual in a system whose promise is confidentiality.
  //
  // The status check is folded into the SAME boolean on purpose. Written as its own
  // `if` with its own error text, an invited or deactivated account gets a different
  // message from a wrong password, and criterion 4 is silently broken.
  const ok = user && user.status === "active" && (await user.comparePassword(password));
  if (!ok) throw new AppError("Invalid credentials", 401);

  return { user, token: tokenFor(user) };
};
