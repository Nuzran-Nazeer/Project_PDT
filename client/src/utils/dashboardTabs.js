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
// ⚠️ ONLY DELIVERED GROUPS ARE HERE. The mockups design 30 screens across six roles.
// The employee group landed with story 15 and the supervisor group with story 17; the
// HR, oversight, leadership and admin groups are still held out, because their tabs
// are their own stories' work. Their definitions are kept verbatim in
// `Project PDT/PDT-DASHBOARD-TABS-PENDING.md`, which sits outside the repository,
// along with the three edits needed to put a group back.

// The label above each group in the sidebar. The employee group has two, because the
// mockups call it MENU when it is all a person has and MY OWN APPRAISAL when it sits
// underneath a wider role's group.
export const GROUP_LABELS = {
  employee: { primary: "Menu", secondary: "My own appraisal" },
  supervisor: { primary: "Supervisor", secondary: "Supervisor" },
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
  supervisor: {
    pageTitle: "Supervisor dashboard",
    roleLabel: "Supervisor",
    primaryHeading: "Your team",
    secondaryHeading: "Your team",
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

  supervisor: [
    {
      id: "my-team",
      path: "/my-team",
      label: "My team",
      icon: "users",
      title: "My team",
      description: "The people you supervise this cycle",
      // The only supervisor tab with data behind it. The PEOPLE are real, read from
      // the unit tree and the dated leadership records; their submissions are not,
      // because no cycle or review collection exists.
      built: true,
    },
    {
      id: "reviews-i-owe",
      path: "/reviews-i-owe",
      label: "Reviews I owe",
      icon: "clipboard",
      title: "Reviews I owe",
      description: "Write a review once colleague feedback is in",
      built: false,
      // Criterion 3. A review is READY when the self-assessment is in and the minimum
      // colleague responses have arrived, and BLOCKED otherwise, saying which is
      // missing. Both halves of that test need collections that do not exist.
    },
    {
      id: "colleague-feedback",
      path: "/colleague-feedback",
      label: "Colleague feedback",
      icon: "message",
      title: "Colleague feedback to read",
      description: "Released in batches once half have submitted",
      built: false,
      // ⚠️ THIS IS THE TRIPWIRE. It is the first screen that would serve a feedback
      // record, and the shared function that strips reviewer identity does not exist
      // yet. That function must land BEFORE this tab is built, not after: retrofitting
      // anonymity means walking back through every working endpoint removing a field,
      // with no error when one is missed.
    },
    {
      id: "team-plans",
      path: "/team-plans",
      label: "Team plans",
      icon: "trend",
      title: "Team development plans",
      description: "Progress on the actions your team agreed",
      built: false,
    },
  ],
};

// Every tab flattened, for the router and for looking one up by its path.
export const ALL_TABS = Object.values(TABS_BY_GROUP).flat();

export function tabByPath(path) {
  return ALL_TABS.find((tab) => tab.path === path);
}
