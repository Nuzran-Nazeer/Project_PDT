const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/token");
const { listLeads } = require("./unitlead.service");

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

// ---------------------------------------------------------------------------
// Who is signed in, right now
// ---------------------------------------------------------------------------
// The token is minted at login and never changes. Make somebody HR at ten in the
// morning and their token still says employee until it expires, so a screen built
// from the token shows yesterday's answer. This re-reads the record instead.
//
// It also answers the question no role list can. `supervisor` is DERIVED and is not
// grantable: a person is a supervisor because they lead a unit today, which lives in
// the leadership records, not on their user document. Without this, nothing on the
// client can know it -- and working it out on the client would mean a screen deciding
// what somebody is, which is the one thing rule 1 exists to stop.
exports.currentSession = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("Not authenticated", 401);

  // Deactivated between issuing the token and now. Login already refuses these
  // accounts; letting one keep working until its token expires would mean a leaver
  // holds access for the rest of the day.
  if (user.status !== "active") throw new AppError("Not authenticated", 401);

  // Today, not a date the caller chose. This endpoint answers "what am I now" --
  // asking it about a past date is a different question, and no story asks it.
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
