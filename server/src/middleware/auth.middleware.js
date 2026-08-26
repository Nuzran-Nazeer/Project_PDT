const { verifyToken } = require("../utils/token");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

// Authentication: verify the JWT and attach req.user.
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AppError("Not authenticated", 401);

  try {
    req.user = verifyToken(token); // { id, roles, iat, exp }
    next();
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
});

// Authorization: allow anyone holding at least one of the given roles.
// Must run after protect.
//
// ⚠️ INTERIM. Routes are supposed to name an ACTION, not a role —
// requirePermission("user:create") reading a single map in config/roles.js.
// See design decision G7. That file is the next piece of work; until it exists,
// this checks roles directly and the access policy stays scattered across routes.
//
// A user's roles are the GRANTED ones on their record. `supervisor` is derived from
// the org structure and is not in the token — supervisor-scoped access arrives with
// the unit collections.
const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    const held = req.user?.roles || [];
    if (!held.some((r) => allowedRoles.includes(r))) {
      throw new AppError("You do not have permission for this action", 403);
    }
    next();
  };

// Authorization: allow the person the record is ABOUT, or anyone holding one of the
// given roles. Must run after protect.
//
// This is the first scope check in the codebase, and it is deliberately the narrowest
// one possible: "your own, and only your own". It compares the id in the URL against
// the id in the token, so nothing a client sends can widen it.
//
// It is NOT the coverage check HR needs. A reader role still reaches everybody here;
// limiting HR to the units they cover is a separate story and a separate gate.
const authorizeSelfOr =
  (param, ...allowedRoles) =>
  (req, res, next) => {
    const held = req.user?.roles || [];
    const isSelf = String(req.params[param]) === String(req.user?.id);
    if (!isSelf && !held.some((r) => allowedRoles.includes(r))) {
      throw new AppError("You do not have permission for this action", 403);
    }
    // Downstream needs to know WHICH of the two got them in: a reader sees the whole
    // answer, somebody reading their own record sees only what the story grants them.
    req.isSelfRead = isSelf && !held.some((r) => allowedRoles.includes(r));
    next();
  };

module.exports = { protect, authorize, authorizeSelfOr };
