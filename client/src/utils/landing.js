// Where each role's dashboard lives.
//
// The role NAMES are the server's — they come from config/constants.js and must
// match exactly. The paths are the client's own business, which is why this map
// is here and not something the API returns.
export const DASHBOARD_PATHS = {
  head_of_hr: "/head-of-hr",
  hr: "/hr",
  leadership: "/leadership",
  admin: "/admin",
  supervisor: "/supervisor",
  employee: "/employee",
};

// Everyone holds `employee`, so this is the fallback that always resolves —
// used when the constants request failed and no order is available.
const FALLBACK = DASHBOARD_PATHS.employee;

// The dashboard a user lands on: the first role in the server's precedence order
// that they actually hold.
//
// The ORDER is not decided here. It arrives from GET /api/constants as
// `rolePrecedence`, so the client and the server cannot disagree about it — a
// second copy would drift, and a drifted ordering fails silently: nothing throws,
// the user simply lands somewhere unexpected. (Build decision B7)
// `isSupervisor` is passed separately because it is NOT a granted role and never
// appears in `roles`. The server's order puts supervisor above employee, so
// without this a person who leads a unit lands on the employee dashboard and the
// order is quietly wrong for exactly the people it was written for.
export function landingPathFor(roles, precedence, isSupervisor = false) {
  if (!Array.isArray(roles) || roles.length === 0) return FALLBACK;
  if (!Array.isArray(precedence) || precedence.length === 0) return FALLBACK;

  const held = precedence.find((role) =>
    role === "supervisor" ? isSupervisor : roles.includes(role),
  );
  return DASHBOARD_PATHS[held] || FALLBACK;
}
