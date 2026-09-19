// ⚠️ Grants nothing: it decides which sections appear. Access is decided per record on
// the server, and it is not a ladder.

// Not read from the server's role precedence, which may fail silently and leave no order.
const SECTION_ORDER = ["oversight", "hr", "leadership", "supervisor", "employee"];

const GROUPS_BY_ROLE = {
  head_of_hr: ["oversight", "hr"],
  hr: ["hr"],
  leadership: ["leadership"],
};

// The gate on which groups are rendered.
const DELIVERED_GROUPS = ["employee", "supervisor", "hr", "oversight", "leadership"];

export function sectionGroupsFor(roles, isSupervisor = false) {
  const held = Array.isArray(roles) ? roles : [];

  if (held.includes("admin")) {
    return DELIVERED_GROUPS.includes("admin") ? ["admin"] : [];
  }

  const groups = new Set(["employee"]);

  if (isSupervisor) groups.add("supervisor");

  held.forEach((role) => {
    (GROUPS_BY_ROLE[role] || []).forEach((group) => groups.add(group));
  });

  return SECTION_ORDER.filter(
    (group) => groups.has(group) && DELIVERED_GROUPS.includes(group),
  );
}
