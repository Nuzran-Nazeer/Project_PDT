// The role NAMES are the server's, from config/constants.js, and must match exactly.
// The paths are the client's own business, which is why this map is not something the
// API returns.
export const DASHBOARD_PATHS = {
  head_of_hr: "/head-of-hr",
  hr: "/hr",
  leadership: "/leadership",
  admin: "/admin",
  supervisor: "/supervisor",
  employee: "/employee",
};

// Everyone holds `employee`, so this always resolves.
const FALLBACK = DASHBOARD_PATHS.employee;

// The order is not decided here. It arrives from GET /api/constants as
// `rolePrecedence`, because a second copy would drift and a drifted ordering fails
// silently: nothing throws, the user simply lands somewhere unexpected.
// (Build decision B7)
//
// `isSupervisor` is passed separately because it is not a granted role. The server's
// order puts supervisor above employee, so without it someone who leads a unit lands
// on the employee dashboard.
export function landingPathFor(roles, precedence, isSupervisor = false) {
  if (!Array.isArray(roles) || roles.length === 0) return FALLBACK;
  if (!Array.isArray(precedence) || precedence.length === 0) return FALLBACK;

  const held = precedence.find((role) =>
    role === "supervisor" ? isSupervisor : roles.includes(role),
  );
  return DASHBOARD_PATHS[held] || FALLBACK;
}
