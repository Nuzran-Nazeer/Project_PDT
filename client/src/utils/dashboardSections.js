// ⚠️ THIS ORDERS NOTHING AND GRANTS NOTHING. It decides which sections appear on a
// screen. What a person may READ is decided per record on the server, and access is
// NOT a ladder: `if (role >= hr)` is the thing this design exists to avoid.

// Deliberately not read from the server's role precedence, which arrives with the
// constants request and may fail silently, leaving the sections in no order at all.
const SECTION_ORDER = ["oversight", "hr", "leadership", "supervisor", "employee"];

// Head of HR carries the HR sections too, whether or not they hold the `hr` role.
const GROUPS_BY_ROLE = {
  head_of_hr: ["oversight", "hr"],
  hr: ["hr"],
  leadership: ["leadership"],
};

// The registry above holds every group; this decides which are rendered.
const DELIVERED_GROUPS = ["employee", "supervisor", "hr", "leadership"];

export function sectionGroupsFor(roles, isSupervisor = false) {
  const held = Array.isArray(roles) ? roles : [];

  // An admin has no unit, project or supervisor, so there is nothing to merge with.
  if (held.includes("admin")) {
    return DELIVERED_GROUPS.includes("admin") ? ["admin"] : [];
  }

  const groups = new Set(["employee"]);

  // `supervisor` is never in `roles`: it is derived from who leads a unit today.
  if (isSupervisor) groups.add("supervisor");

  held.forEach((role) => {
    (GROUPS_BY_ROLE[role] || []).forEach((group) => groups.add(group));
  });

  return SECTION_ORDER.filter(
    (group) => groups.has(group) && DELIVERED_GROUPS.includes(group),
  );
}
