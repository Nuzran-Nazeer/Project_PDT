// ONE REGISTRY, read by three things: the sidebar, the dashboard's action rows, and
// the router. Adding a screen is a row here, not an edit to three files.
//
// `built: false` means the tab exists, is reachable, and its page says plainly that it
// has not been built.
//
// ⚠️ Oversight and admin are deliberately absent. Their definitions, and the three
// edits needed to add a group, are in PDT-DASHBOARD-TABS-PENDING.md, outside the
// repository.

// The employee group has two labels: one when it is all a person has, another when it
// sits underneath a wider role's group.
export const GROUP_LABELS = {
  employee: { primary: "Menu", secondary: "My own appraisal" },
  supervisor: { primary: "Supervisor", secondary: "Supervisor" },
  hr: { primary: "HR", secondary: "HR" },
  leadership: { primary: "Leadership", secondary: "Leadership" },
};

// The heading above this group's action rows, and the page title when it is the
// person's widest group.
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
  hr: {
    pageTitle: "HR officer dashboard",
    roleLabel: "HR officer",
    primaryHeading: "Running the cycle",
    secondaryHeading: "Running the cycle",
  },
  leadership: {
    pageTitle: "Leadership dashboard",
    roleLabel: "Leadership",
    primaryHeading: "Company",
    secondaryHeading: "Company",
  },
};

// Belongs to no group: it sits at the top of the first group in the sidebar.
export const DASHBOARD_TAB = {
  id: "dashboard",
  path: "/dashboard",
  label: "Dashboard",
  icon: "user",
  built: true,
};

export const TABS_BY_GROUP = {
  // Two sub-sections, because running this year's cycle and maintaining the standing
  // record of who works here are different jobs.
  //
  // ⚠️ `ownRoute: true` means the ROUTER ALREADY HAS A ROUTE for this path and must
  // not generate a second one. Those paths carry finer gates than a group gate can
  // express, and a generated route would sit BEFORE the hand-written one and quietly
  // narrow it, locking readers out of screens they may open.
  // ⚠️ Nothing here widens access. Every People data row is a screen Leadership can
  // already open; this only draws a link to it.
  leadership: [
    {
      section: "Company",
      id: "rating-distribution",
      path: "/rating-distribution",
      label: "Rating distribution",
      icon: "chart",
      title: "Rating distribution",
      description: "Company wide spread, with no names behind any figure",
      built: false,
    },
    {
      section: "Company",
      id: "plan-progress",
      path: "/plan-progress",
      label: "Plan progress",
      icon: "trend",
      title: "Plan progress",
      description: "How development actions are moving across the company",
      built: false,
    },
    {
      section: "Company",
      id: "audit-counts",
      path: "/audit-counts",
      label: "Audit counts",
      icon: "key",
      title: "Audit counts",
      description: "How often identities were revealed, as counts only",
      built: false,
    },
    {
      section: "People data",
      id: "leadership-employees",
      path: "/employees",
      label: "Employee records",
      icon: "users",
      title: "Employee records",
      description: "Everyone at Altrium. Leadership reads; HR writes",
      built: true,
      ownRoute: true,
    },
    {
      section: "People data",
      id: "leadership-organisation",
      path: "/organisation",
      label: "Organisation",
      icon: "sitemap",
      title: "Organisation structure",
      description: "The unit tree, who belongs to each unit, and who leads it",
      built: true,
      ownRoute: true,
    },
    {
      section: "People data",
      id: "leadership-cycles",
      path: "/cycles",
      label: "Cycles",
      icon: "target",
      title: "Appraisal cycles",
      description: "Which cycle each group is in. Only HR can change them",
      built: true,
      ownRoute: true,
    },
  ],
  hr: [
    {
      section: "Running the cycle",
      id: "cycles",
      path: "/cycles",
      label: "Cycles",
      icon: "target",
      title: "Appraisal cycles",
      description: "Create a cycle, open it, and move it through its stages",
      built: true,
      ownRoute: true,
    },
    {
      section: "Running the cycle",
      id: "cycle-progress",
      path: "/cycle-progress",
      label: "Cycle progress",
      icon: "chart",
      title: "Cycle progress",
      description: "Not started, in progress and complete by group and unit",
      built: false,
    },
    {
      section: "Running the cycle",
      id: "summaries-to-check",
      path: "/summaries-to-check",
      label: "Summaries to check",
      icon: "check",
      title: "Summaries to check",
      description: "Compare each summary against the raw comments before publication",
      built: false,
    },
    {
      section: "Running the cycle",
      id: "reviewer-identity",
      path: "/reviewer-identity",
      label: "Reviewer identity",
      icon: "key",
      title: "Reviewer identity",
      description: "Reveal who gave a piece of feedback, with a written reason",
      built: false,
    },
    {
      section: "People data",
      id: "employee-records",
      path: "/employees",
      label: "Employee records",
      icon: "users",
      title: "Employee records",
      description: "Everyone at Altrium, and the record behind each of them",
      built: true,
      ownRoute: true,
    },
    {
      section: "People data",
      id: "organisation",
      path: "/organisation",
      label: "Organisation",
      icon: "sitemap",
      title: "Organisation structure",
      description: "The unit tree, who belongs to each unit, and who leads it",
      built: true,
      ownRoute: true,
    },
    {
      section: "People data",
      id: "projects",
      path: "/projects",
      label: "Projects",
      icon: "briefcase",
      title: "Projects and assignments",
      description: "Cross unit work, project leads and team leads",
      built: false,
    },
  ],
  employee: [
    {
      id: "my-self-assessment",
      path: "/my-self-assessment",
      label: "My self-assessment",
      icon: "clipboard",
      title: "My self-assessment",
      description: "Complete or review your own assessment",
      built: false,
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
      // ⚠️ Summary only: no individual comment, no rating, and no count of how many
      // people responded. A count alone identifies a reviewer in a small team, so it
      // is excluded rather than merely hidden.
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
      id: "team-feedback",
      path: "/team-feedback",
      label: "Team feedback",
      icon: "message",
      title: "Team feedback",
      description: "What the people you supervise said about you, anonymised",
      built: false,
      // Renamed from "Colleague feedback". Upward feedback, not what a supervisor
      // reads about their team, which lives on the team member screen.
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
