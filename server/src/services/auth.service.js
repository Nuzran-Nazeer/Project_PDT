const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/token");
const { listLeads } = require("./unitlead.service");

// Everything a token carries. Kept in one place so no route invents its own shape.
const tokenFor = (user) => signToken({ id: user._id, roles: user.roles });

// No self-registration: HR creates the account, the employee opens it with an invite
// code. (Build decision B4)

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

  // ⚠️ ONE message for "no such account", "wrong password" and "account disabled",
  // or anyone can probe which addresses belong to staff. The status check is folded
  // into the SAME boolean deliberately: its own `if` would give it its own message.
  const ok = user && user.status === "active" && (await user.comparePassword(password));
  if (!ok) throw new AppError("Invalid credentials", 401);

  return { user, token: tokenFor(user) };
};

// The token is minted at login and never changes, so a screen built from it shows
// yesterday's answer. This re-reads the record.
//
// It also answers what no role list can: `supervisor` is derived from who leads a unit
// today, and working it out on the client would be a screen deciding what somebody is.
exports.currentSession = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("Not authenticated", 401);

  // Deactivated since the token was issued: otherwise a leaver holds access until it
  // expires.
  if (user.status !== "active") throw new AppError("Not authenticated", 401);

  // Today, not a date the caller chose: this answers "what am I now".
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
