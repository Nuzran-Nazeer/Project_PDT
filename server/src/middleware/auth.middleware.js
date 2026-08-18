const { verifyToken } = require("../utils/token");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

// Authentication: verify the JWT and attach req.user.
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AppError("Not authenticated", 401);

  try {
    req.user = verifyToken(token); // { id, role, iat, exp }
    next();
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
});

// Authorization: allow only the given roles (must run after protect).
const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError("You do not have permission for this action", 403);
    }
    next();
  };

module.exports = { protect, authorize };
