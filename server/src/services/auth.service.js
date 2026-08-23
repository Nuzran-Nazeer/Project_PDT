const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/token");

// Everything a token carries. Kept in one place so no route invents its own shape.
const tokenFor = (user) => signToken({ id: user._id, roles: user.roles });

// Accounts are created by HR (POST /api/users) and opened by the employee with an
// invite code (POST /api/auth/activate). There is no self-registration: nobody signs
// themselves up for their employer's HR system.  (Build decision B4, closed 2026-08-24)

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
