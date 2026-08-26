// Every tab in the sidebar, grouped the way the mockups group them.
//
// ONE REGISTRY, READ BY THREE THINGS: the sidebar draws its groups and links from it,
// the dashboard overview draws its action rows from it, and the router builds a route
// per tab from it. Adding a screen means adding a row here, not editing three files
// and forgetting the third.
//
// `built: false` means the tab exists, is reachable, and its page says plainly that
// it has not been built. That is deliberate. A skeleton that runs end to end can be
// demonstrated from week two; four finished features and no flow cannot, which is the
// choice the spec made for Sprint 1 and the reason these are here rather than absent.
//
// `title` and `description` are the mockups' own wording, so the running app and the
// deck in Deliverables/UI-Mockups/ say the same thing.
//
// ⚠️ ONLY THE EMPLOYEE GROUP IS HERE. The mockups design 30 screens across six roles,
// and the supervisor, HR, oversight, leadership and admin groups were written out in
// full while this machinery was being built. They were taken back out on 2026-08-26:
// the HR dashboard is story 16 and the supervisor dashboard is story 17, so their tabs
// are their stories' work, not this one's. The definitions are kept verbatim in
// `Project PDT/PDT-DASHBOARD-TABS-PENDING.md`, which sits outside the repository, along
// with the three edits needed to put a group back.

// The label above each group in the sidebar. The employee group has two, because the
// mockups call it MENU when it is all a person has and MY OWN APPRAISAL when it sits
// underneath a wider role's group.
export const GROUP_LABELS = {
  employee: { primary: "Menu", secondary: "My own appraisal" },
};

// The heading above this group's action rows on the overview, and the page title when
// this is the person's widest group. Both come from the mockups.
export const GROUP_OVERVIEW = {
  employee: {
    pageTitle: "Employee dashboard",
    roleLabel: "Employee",
    primaryHeading: "Actions",
    secondaryHeading: "My own appraisal",
  },
};

// The dashboard itself belongs to no group: everybody has exactly one, and it sits at
// the top of the first group in the sidebar.
export const DASHBOARD_TAB = {
  id: "dashboard",
  path: "/dashboard",
  label: "Dashboard",
  icon: "user",
  built: true,
};

export const TABS_BY_GROUP = {
  employee: [
    {
      id: "my-self-assessment",
      path: "/my-self-assessment",
      label: "My self-assessment",
      icon: "clipboard",
      title: "My self-assessment",
      description: "Complete or review your own assessment",
      built: false,
      // Six competencies: four shared and two from the job family, worded for the
      // self viewpoint, each one scorable or markable as not observed. Nothing in the
      // code hardcodes that set, so seeding it is server work and comes first.
    },
    {
      id: "feedback-i-owe",
      path: "/feedback-i-owe",
      label: "Feedback I owe",
      icon: "message",
      title: "Feedback I owe",
      description: "Colleague reviews assigned to you",
      built: false,
    },
    {
      id: "my-result",
      path: "/my-result",
      label: "My result",
      icon: "file",
      title: "My result",
      description: "View and acknowledge a published result",
      built: false,
      // The one screen where the confidentiality rule is load bearing. It shows a
      // summary and nothing else: no individual comment, no rating, and no count of
      // how many people responded. A count alone identifies a reviewer in a small
      // team, which is why it is excluded rather than merely hidden.
    },
    {
      id: "my-development-plan",
      path: "/my-development-plan",
      label: "My development plan",
      icon: "trend",
      title: "My development plan",
      description: "Track the actions agreed with your supervisor",
      built: false,
    },
    {
      id: "my-history",
      path: "/my-history",
      label: "My history",
      icon: "book",
      title: "My history",
      description: "Every past cycle, with no time limit",
      built: false,
    },
  ],
};

// Every tab flattened, for the router and for looking one up by its path.
export const ALL_TABS = Object.values(TABS_BY_GROUP).flat();

export function tabByPath(path) {
  return ALL_TABS.find((tab) => tab.path === path);
}
