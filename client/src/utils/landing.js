// The role names are the server's and must match exactly.
export const DASHBOARD_PATHS = {
  head_of_hr: "/head-of-hr",
  hr: "/hr",
  leadership: "/leadership",
  admin: "/admin",
  supervisor: "/supervisor",
  employee: "/employee",
};

const FALLBACK = DASHBOARD_PATHS.employee;

// The order arrives from the server as `rolePrecedence` (B7). `isSupervisor` is passed
// separately because it is not a granted role.
export function landingPathFor(roles, precedence, isSupervisor = false) {
  if (!Array.isArray(roles) || roles.length === 0) return FALLBACK;
  if (!Array.isArray(precedence) || precedence.length === 0) return FALLBACK;

  const held = precedence.find((role) =>
    role === "supervisor" ? isSupervisor : roles.includes(role),
  );
  return DASHBOARD_PATHS[held] || FALLBACK;
}
