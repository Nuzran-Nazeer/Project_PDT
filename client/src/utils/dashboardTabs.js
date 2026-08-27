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
  hr: { primary: "HR", secondary: "HR" },
  leadership: { primary: "Leadership", secondary: "Leadership" },
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
  // The HR group, delivered 2026-08-27.
  //
  // TWO SUB-SECTIONS, because the mockup splits it that way: `13-hr-dashboard.png`
  // separates RUNNING THE CYCLE from PEOPLE DATA. A flat list of seven tabs loses
  // that, and the two halves are genuinely different jobs -- one is this year's
  // appraisal round, the other is the standing record of who works here.
  //
  // ⚠️ `ownRoute: true` means the ROUTER ALREADY HAS A ROUTE for this path and must
  // not generate a second one. Employee records, Organisation and Cycles were built
  // by earlier stories and carry finer gates than a group gate can express: reading
  // the roster is open to Leadership, creating a record is HR only, and a generated
  // route would sit BEFORE the hand-written one and quietly narrow it. Getting this
  // wrong locks Leadership out of screens they are supposed to read.
  // The leadership group, delivered 2026-08-27 ALONGSIDE the HR one, and it had to be.
  //
  // Employee records, Organisation and Cycles moved out of the header into the HR
  // group in the same change. Leadership may READ all three -- their routes say so,
  // and have since the stories that built them -- so with the header gone and no
  // group of their own, a Leadership account was left able to reach those screens by
  // typing the URL and by no other means. That is a navigation regression, not a
  // permission one, and shipping it would have been worse than the duplicated
  // navigation it replaced.
  //
  // NOTHING HERE WIDENS ACCESS. Every People data row is a screen Leadership could
  // already open; this draws a link to it. The three Company tabs are the mockups'
  // own and none has data behind it yet.
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
