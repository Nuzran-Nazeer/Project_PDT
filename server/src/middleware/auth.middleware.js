const { verifyToken } = require("../utils/token");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AppError("Not authenticated", 401);

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
});

// ⚠️ Interim: routes are supposed to name an action, not a role. `supervisor` is
// derived and never in the token.
const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    const held = req.user?.roles || [];
    if (!held.some((r) => allowedRoles.includes(r))) {
      throw new AppError("You do not have permission for this action", 403);
    }
    next();
  };

// The person the record is about, or anyone holding one of the roles.
// ⚠️ Not the coverage check HR needs: a reader role still reaches everybody.
const authorizeSelfOr =
  (param, ...allowedRoles) =>
  (req, res, next) => {
    const held = req.user?.roles || [];
    const isSelf = String(req.params[param]) === String(req.user?.id);
    if (!isSelf && !held.some((r) => allowedRoles.includes(r))) {
      throw new AppError("You do not have permission for this action", 403);
    }
    // A reader sees the whole answer; somebody reading their own record sees less.
    req.isSelfRead = isSelf && !held.some((r) => allowedRoles.includes(r));
    next();
  };

module.exports = { protect, authorize, authorizeSelfOr };
