const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/token");
const { listLeads } = require("./unitlead.service");

const tokenFor = (user) => signToken({ id: user._id, roles: user.roles });

// No self-registration: HR creates the account, the employee opens it with an invite code (B4).

exports.login = async ({ identifier, email, username, password }) => {
  const login = identifier || email || username;
  if (!login || !password) {
    throw new AppError("Email or username, and password, are required", 400);
  }

  const key = String(login).toLowerCase().trim();
  const user = await User.findOne({
    $or: [{ email: key }, { username: key }],
  }).select("+password");

  // ⚠️ One message for "no such account", "wrong password" and "account disabled", or
  // anyone can probe which addresses belong to staff. Keep the status check in this boolean.
  const ok = user && user.status === "active" && (await user.comparePassword(password));
  if (!ok) throw new AppError("Invalid credentials", 401);

  return { user, token: tokenFor(user) };
};

// Re-reads the record: the token never changes after login, and `supervisor` is derived.
exports.currentSession = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("Not authenticated", 401);

  // Deactivated since the token was issued.
  if (user.status !== "active") throw new AppError("Not authenticated", 401);

  const { items } = await listLeads({ userId: user._id, on: new Date() });

  return {
    user,
    leadsUnits: items.map((r) => ({
      id: r.unitId?._id,
      name: r.unitId?.name,
      type: r.unitId?.type,
    })),
    isSupervisor: items.length > 0,
  };
};
