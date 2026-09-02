// ⚠️ Nothing outside this file types one of these strings. A typo'd role written
// inline is a silent bug; imported from here it is `undefined` and fails loudly.

// ⚠️ `supervisor` is DERIVED, never stored: you are one because you lead a unit on a
// date. Storing it goes stale the moment anyone moves. The User record holds only
// GRANTED roles.
const GRANTABLE_ROLES = ["employee", "hr", "head_of_hr", "leadership", "admin"];
const DERIVED_ROLES = ["supervisor"];
const ROLES = [...GRANTABLE_ROLES, ...DERIVED_ROLES];

// Which dashboard a multi-role user lands on: the first entry they hold. A ROUTING
// order, not seniority. `employee` is last because everyone holds it, so it always
// matches. (Build decision B7)
const ROLE_PRECEDENCE = [
  "head_of_hr",
  "hr",
  "leadership",
  "admin",
  "supervisor",
  "employee",
];

// Three states, not a boolean: a boolean cannot tell "invited but never activated"
// from "no longer works here".
const USER_STATUS = ["invited", "active", "inactive"];

const LOCATIONS = ["Colombo"];

// ⚠️ "team" is deliberately absent: a team is the slice of one unit on one project,
// derived from assignments and never in the org tree.
//
// These are LABELS, not depths. Nothing checks that a sub-unit sits under a unit: the
// tree is recursive and three names cannot describe five levels.
const ORG_UNIT_TYPES = ["company", "unit", "sub-unit"];

// The review form is chosen by JOB FAMILY, not designation, so HR can add a
// designation without anyone building a form.
const JOB_FAMILIES = [
  "Engineering",
  "Quality",
  "Analysis & Product",
  "Design",
  "Delivery",
  "Data",
  "Corporate",
  "Leadership",
];

const DESIGNATIONS = {
  "Software Engineer": "Engineering",
  "Senior Software Engineer": "Engineering",
  "Tech Lead": "Engineering",
  "Principal Engineer": "Engineering",
  "DevOps Engineer": "Engineering",
  "Cloud Engineer": "Engineering",
  "Mobile Engineer": "Engineering",
  "Data Engineer": "Engineering",

  "QA Engineer": "Quality",
  "Senior QA Engineer": "Quality",
  "QA Automation Engineer": "Quality",
  "QA Lead": "Quality",

  "Business Analyst": "Analysis & Product",
  "Systems Analyst": "Analysis & Product",
  "Product Owner": "Analysis & Product",

  "UI/UX Designer": "Design",
  "Senior Designer": "Design",
  "UX Researcher": "Design",

  "Project Manager": "Delivery",
  "Delivery Manager": "Delivery",
  "Scrum Master": "Delivery",

  "Data Analyst": "Data",
  "Data Scientist": "Data",

  "HR Officer": "Corporate",
  "HR Manager": "Corporate",
  "Talent Acquisition": "Corporate",
  "Finance Officer": "Corporate",
  "Office Administrator": "Corporate",

  "Head of Engineering": "Leadership",
  "Head of Quality": "Leadership",
  "Head of HR": "Leadership",
  CTO: "Leadership",
  CEO: "Leadership",
};

const DESIGNATION_NAMES = Object.keys(DESIGNATIONS);

// ⚠️ Set ONCE at creation and never moved: moving someone between groups changes
// which cycle their history belongs to.
const PAR_GROUPS = ["April", "August", "December"];

// Joining month (0 = January) -> group.
function parGroupFor(joinedDate) {
  if (!joinedDate) return undefined;
  const month = new Date(joinedDate).getMonth();
  if (month >= 3 && month <= 6) return "August"; // Apr to Jul
  if (month >= 7 && month <= 10) return "December"; // Aug to Nov
  return "April"; // Dec to Mar
}

// ⚠️ The username is generated from this ID's digits, so the shape is enforced:
// `ALT-0241` and `A-0241` would otherwise generate the same username.
const EMPLOYEE_ID_PATTERN = /^ALT-\d{4}$/;

const BCRYPT_COST = 10; // OWASP Password Storage Cheat Sheet: work factor >= 10
const MIN_PASSWORD_LENGTH = 8;

// 32 random bytes, so 64 hex characters. See utils/inviteCode.js for why that allows
// a fast hash rather than a slow one.
const INVITE_CODE_BYTES = 32;

// Long enough to survive a weekend and a first day, short enough that a forgotten
// invite is not open for a month. Not specified by the design; one line to change.
const INVITE_EXPIRY_DAYS = 7;

// ⚠️ THE ORDER IS THE RULE, not documentation: a cycle moves forward one stage at a
// time, and the service checks every requested move against this sequence.
const CYCLE_STAGES = [
  "draft",
  "open",
  "collecting",
  "supervisor_review",
  "normalising",
  "published",
  "closed",
];

// Cancelled is deliberately not in that list: it is a branch, not a stage, and
// keeping it out stops "advance one stage" landing on it.
const CYCLE_CANCELLED = "cancelled";

const CYCLE_STATUS = [...CYCLE_STAGES, CYCLE_CANCELLED];

// The next stage after each one, or null where there is nowhere to go.
const NEXT_STAGE = CYCLE_STAGES.reduce((map, stage, i) => {
  map[stage] = CYCLE_STAGES[i + 1] || null;
  return map;
}, {});

// ⚠️ Measured from OPENING, not creation. Everything in a cycle happens at its end,
// so 30 days is guaranteed to fall before anybody has submitted anything. That
// guarantee is why the figure is what it is, and it holds only from opening.
const CYCLE_CANCEL_WINDOW_DAYS = 30;

// Feedback

const REVIEWER_TYPES = [
  "self",
  "peer",
  "supervisor",
  "project_lead",
  "team_lead",
  "upward",
];

// ⚠️ THE TWO TYPES THAT MUST NEVER REACH A REVIEWEE OR THEIR SUPERVISOR WITH A NAME
// ON THEM. The other four are ATTRIBUTED on purpose: feedback an employee cannot
// attribute is feedback they cannot follow up. Wrong in either direction is a bug.
const CONFIDENTIAL_REVIEWER_TYPES = ["peer", "upward"];

const FEEDBACK_STATUS = ["assigned", "draft", "submitted", "locked"];

// The author may still edit for this long after submitting. `locksAt` is `submittedAt`
// plus this window, and the next stage stays gated until it passes so nobody reviews a
// document that is still changing.
const FEEDBACK_EDIT_WINDOW_HOURS = 5;

// ⚠️ Stripped from a FEEDBACK record served to a reviewee or their supervisor. The
// timestamps are here because a submission time is an identity: it correlates against
// who was on leave, or who mentioned they had a review to write.
const IDENTIFYING_FIELDS = [
  "reviewerId",
  "reviewerName",
  "submittedAt",
  "createdAt",
  "updatedAt",
];

// ⚠️ The subset no response may EVER carry without an authorised identity read. Kept
// apart from the list above because `createdAt` is ordinary on a user or a unit and
// only becomes identifying on feedback, so guarding it globally would refuse every
// endpoint in the system.
const NEVER_SERVED_FIELDS = ["reviewerId", "reviewerName"];

// Competencies
//
// SIX PER REVIEW: four shared by everyone, plus two for the reviewee's job family.
//
// ⚠️ NOTHING MAY HARDCODE THE NUMBER SIX. Anything iterating competencies reads the
// list; anything averaging divides by what it FOUND, never by a literal. Changing this
// list should cost an edit to this file and nothing else.
//
// ⚠️ THE KEY IS THE IDENTITY, NEVER THE NAME. Feedback stores `competencyKey`, so
// renaming a competency leaves every stored record meaning what it meant. A key must
// never be renamed, and never reused for a different competency.

// These four carry cross-family comparison, so they must read identically for an
// engineer, a tester and an HR officer.
const SHARED_COMPETENCIES = [
  {
    key: "collaboration",
    name: "Communication & collaboration",
    definition:
      "Shares information clearly, listens, and works constructively with others across teams.",
  },
  {
    key: "ownership",
    name: "Ownership & accountability",
    definition:
      "Takes responsibility for outcomes in their area, including when work goes wrong.",
  },
  {
    key: "delivery",
    name: "Delivery & dependability",
    definition:
      "Meets what was agreed, or flags and renegotiates early rather than late.",
  },
  {
    key: "learning",
    name: "Learning & growth",
    definition: "Seeks out new skills and techniques and applies them in practice.",
  },
];

// Keyed by job family, itself derived from designation, so nobody picks their own
// form.
const FAMILY_COMPETENCIES = {
  Engineering: [
    {
      key: "technical_quality",
      name: "Technical quality",
      definition:
        "Writes correct, readable, maintainable work that does not need reworking after review.",
    },
    {
      key: "software_design",
      name: "Software design & architecture",
      definition: "Makes sound design choices, weighing scalability against simplicity.",
    },
  ],
  Quality: [
    {
      key: "test_design",
      name: "Test design & coverage",
      definition: "Designs thorough, well-structured tests that cover what matters.",
    },
    {
      key: "defect_detection",
      name: "Defect detection",
      definition: "Finds issues early, and reproduces and reports them precisely.",
    },
  ],
  "Analysis & Product": [
    {
      key: "requirements_analysis",
      name: "Requirements analysis",
      definition:
        "Elicits, analyses and prioritises requirements that are clear enough to build from.",
    },
    {
      key: "domain_understanding",
      name: "Business & domain understanding",
      definition:
        "Grasps the client process, constraints and goals, not just the request.",
    },
  ],
  Design: [
    {
      key: "user_centred_design",
      name: "User-centred design",
      definition: "Designs around real user needs and evidence rather than preference.",
    },
    {
      key: "visual_design",
      name: "Visual design",
      definition: "Strong layout, hierarchy and consistency across a product.",
    },
  ],
  Delivery: [
    {
      key: "planning_organisation",
      name: "Planning & organisation",
      definition:
        "Plans scope, schedule and people realistically, and keeps them current.",
    },
    {
      key: "risk_management",
      name: "Risk management",
      definition: "Anticipates what could go wrong, tracks it, and acts before it does.",
    },
  ],
  // ⚠️ The one pair with no research behind it.
  Data: [
    {
      key: "analytical_rigour",
      name: "Analytical rigour",
      definition:
        "Sound method, stated assumptions, and conclusions the data actually supports.",
    },
    {
      key: "communicating_findings",
      name: "Communicating findings",
      definition: "Turns analysis into something a non-specialist can act on.",
    },
  ],
  Corporate: [
    {
      key: "policy_compliance",
      name: "Policy & compliance",
      definition: "Applies policy and legal requirements correctly and consistently.",
    },
    {
      key: "confidentiality_integrity",
      name: "Confidentiality & integrity",
      definition: "Safeguards sensitive information and handles it with judgement.",
    },
  ],
  Leadership: [
    {
      key: "strategic_thinking",
      name: "Strategic thinking",
      definition: "Sets direction aligned to where the organisation is trying to get to.",
    },
    {
      key: "developing_people",
      name: "Developing people",
      definition: "Builds capability in others, and grows the people around them.",
    },
  ],
};

// Shared first, then the pair. Returns the shared four alone for a family with no
// pair rather than throwing: a short review beats one that cannot open.
function competenciesFor(jobFamily) {
  return [...SHARED_COMPETENCIES, ...(FAMILY_COMPETENCIES[jobFamily] || [])];
}

// Built from the lists rather than typed out, so it cannot fall behind them.
const COMPETENCY_KEYS = [
  ...SHARED_COMPETENCIES.map((c) => c.key),
  ...Object.values(FAMILY_COMPETENCIES).flatMap((list) => list.map((c) => c.key)),
];

module.exports = {
  ROLES,
  GRANTABLE_ROLES,
  DERIVED_ROLES,
  ROLE_PRECEDENCE,
  USER_STATUS,
  LOCATIONS,
  ORG_UNIT_TYPES,
  JOB_FAMILIES,
  DESIGNATIONS,
  DESIGNATION_NAMES,
  PAR_GROUPS,
  parGroupFor,
  SHARED_COMPETENCIES,
  FAMILY_COMPETENCIES,
  competenciesFor,
  COMPETENCY_KEYS,
  CYCLE_STAGES,
  CYCLE_STATUS,
  CYCLE_CANCELLED,
  NEXT_STAGE,
  CYCLE_CANCEL_WINDOW_DAYS,
  REVIEWER_TYPES,
  CONFIDENTIAL_REVIEWER_TYPES,
  FEEDBACK_STATUS,
  FEEDBACK_EDIT_WINDOW_HOURS,
  IDENTIFYING_FIELDS,
  NEVER_SERVED_FIELDS,
  EMPLOYEE_ID_PATTERN,
  BCRYPT_COST,
  MIN_PASSWORD_LENGTH,
  INVITE_CODE_BYTES,
  INVITE_EXPIRY_DAYS,
};
