// Which sections one person's dashboard carries.
//
// THE RULE THIS IMPLEMENTS IS LOCKED (spec §3.12b): one dashboard per person, not
// one per role. Somebody who leads a unit and works in HR gets ONE screen carrying
// their employee, supervisor and HR sections, rather than three screens they switch
// between. A role switcher was considered and rejected: most people hold one or two
// roles, so it is a control that does nothing for the majority.
//
// ⚠️ THIS ORDERS NOTHING AND GRANTS NOTHING. It decides which sections appear on a
// screen. What a person may READ is decided per record by relationship, on the
// server, and access is explicitly NOT a ladder. Anyone who turns this file into
// `if (role >= hr)` has built the thing the design spent a layer avoiding.

// The order sections appear in, widest remit first, so the section closest to why
// this person signed in is at the top and `employee` is last because everyone has it.
//
// It deliberately matches the server's role precedence, the order that decides where
// a user lands after signing in, but it is NOT read from it. That order arrives with
// the constants request, which is allowed to fail silently, and a failed request must
// not leave the sections in no order at all. The cost is a second copy that could
// drift; the consequence of drift here is sections in a surprising order, not a user
// on the wrong screen.
const SECTION_ORDER = [
  "oversight",
  "hr",
  "leadership",
  "supervisor",
  "employee",
];

// A role can bring more than one section group with it. Head of HR carries the HR
// sections as well as their own oversight ones, because the design says their
// dashboard shows both, whether or not they also hold the plain `hr` role.
const GROUPS_BY_ROLE = {
  head_of_hr: ["oversight", "hr"],
  hr: ["hr"],
  leadership: ["leadership"],
};

// WHICH GROUPS HAVE A STORY BEHIND THEM. Added 2026-08-26, on Nuzran's point that the
// HR dashboard is a different story from the employee one and had started appearing
// without being asked for.
//
// The group machinery below is story 15's, because one dashboard per person cannot be
// built without it. The CONTENTS of the other groups belong to their own stories: the
// HR dashboard is story 16, the supervisor dashboard is story 17, and the rest are
// Sprint 2. So the registry keeps every group and this list decides which of them a
// person actually sees.
//
// Adding a group here is the last line of its story, not the first.
const DELIVERED_GROUPS = ["employee"];

export function sectionGroupsFor(roles, isSupervisor = false) {
  const held = Array.isArray(roles) ? roles : [];

  // Admin NEVER merges with anything. An admin has no unit, no project and no
  // supervisor, so they are not on the org chart at all and there is nothing to
  // merge with. This is the one early return in the file and it is deliberate.
  if (held.includes("admin")) {
    return DELIVERED_GROUPS.includes("admin") ? ["admin"] : [];
  }

  const groups = new Set(["employee"]);

  // `supervisor` is not a granted role and never appears in `roles`. A person is a
  // supervisor because they lead a unit today, which only the server can answer, so
  // it arrives separately. Somebody who stops leading a unit loses this section
  // without anybody editing their account.
  if (isSupervisor) groups.add("supervisor");

  held.forEach((role) => {
    (GROUPS_BY_ROLE[role] || []).forEach((group) => groups.add(group));
  });

  return SECTION_ORDER.filter(
    (group) => groups.has(group) && DELIVERED_GROUPS.includes(group),
  );
}
