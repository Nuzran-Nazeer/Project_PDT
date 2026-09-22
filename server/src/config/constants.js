// ⚠️ Nothing outside this file types one of these strings: imported, a typo fails loudly.

// ⚠️ `supervisor` is derived from leading a unit on a date, never stored.
const GRANTABLE_ROLES = ["employee", "hr", "head_of_hr", "leadership", "admin"];
const DERIVED_ROLES = ["supervisor"];

// ⚠️ Only the Head of HR grants these. `head_of_hr` passes every coverage check, so an officer
// who could grant it to themselves would have no scope at all; `admin` and `leadership` reach
// across the whole company by design.
const RESTRICTED_ROLES = ["head_of_hr", "admin", "leadership"];

// ⚠️ An action belongs here only once something in the code performs it. Normalisation rating
// changes, limit and deadline overrides and form-template edits are audited actions in the
// design, and are added when the features that perform them are built.
const AUDIT_ACTIONS = [
  "identity_reveal",
  "cycle_cancellation",
  "colleague_list_decision",
  "history_edit",
  "plan_read",
];
const AUDIT_OUTCOMES = ["allowed", "refused"];

// ⚠️ Why a code and not the message: monitoring has to tell an attempt outside an officer's
// coverage from somebody clicking a draft, and the refusal messages are written for people.
// Reword one and a text match goes quiet without failing.
const AUDIT_REFUSAL_CODES = [
  "not_found",
  "feedback_not_found",
  "not_hr",
  "outside_coverage",
  "own_reporting_line",
  "not_confidential",
  "not_submitted",
];
// The three things worth raising automatically. Everything else in the trail is read on
// suspicion, which is the point of keeping the trail short.
const MONITORING_FLAG_TYPES = [
  "reveal_threshold",
  "improper_reveal",
  "history_edit_in_active_cycle",
];
const MONITORING_FLAG_STATUS = ["open", "reviewed"];

// More than this many identity reveals by one officer within one cycle is unusual. A reveal is
// meant to be rare and investigation-driven; a fourth still succeeds, because an investigation
// stopped halfway has nowhere to go.
const REVEAL_THRESHOLD = 3;

// The refusals that mean somebody reached for something they had no business reaching for.
// The rest are mis-clicks: a draft, or feedback that was never anonymous.
const FLAGGED_REFUSAL_CODES = ["not_hr", "outside_coverage", "own_reporting_line"];

// ⚠️ Where a cycle is actually being worked on. `open` is excluded deliberately: cohort cycles
// run a year each and overlap, so every day of the calendar sits inside one, and flagging on
// that would flag every joiner and handover in the company.
const ACTIVE_CYCLE_STAGES = ["collecting", "supervisor_review", "normalising"];

// Moving a date on any of these moves who supervises, who reviews and who may read. Project
// assignments are absent: they only decided who was eligible to be drawn.
const WATCHED_HISTORY_TARGETS = ["unitMembership", "unitLead", "hrCoverage"];

const AUDIT_TARGETS = [
  "review",
  "cycle",
  "reviewerList",
  "unitMembership",
  "unitLead",
  "projectAssignment",
  "hrCoverage",
  "plan",
];
const ROLES = [...GRANTABLE_ROLES, ...DERIVED_ROLES];

// A routing order, not seniority: the first entry held decides the landing page (B7).
const ROLE_PRECEDENCE = [
  "head_of_hr",
  "hr",
  "leadership",
  "admin",
  "supervisor",
  "employee",
];

const USER_STATUS = ["invited", "active", "inactive"];

const LOCATIONS = ["Colombo"];

// ⚠️ "team" is deliberately absent: a team is one unit's people on one project, derived.
// These are labels, not depths.
const ORG_UNIT_TYPES = ["company", "unit", "sub-unit"];

const HR_COVERAGE_ROLES = ["primary", "backup"];

// Who may be named as an HR officer. Enforced in hrcoverage.service.js.
const HR_OFFICER_ROLES = ["hr", "head_of_hr"];

// The review form is chosen by job family, not designation.
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

// ⚠️ Set once at creation and never moved.
const PAR_GROUPS = ["April", "August", "December"];

// Joining month (0 = January) -> group.
function parGroupFor(joinedDate) {
  if (!joinedDate) return undefined;
  const month = new Date(joinedDate).getMonth();
  if (month >= 3 && month <= 6) return "August"; // Apr to Jul
  if (month >= 7 && month <= 10) return "December"; // Aug to Nov
  return "April"; // Dec to Mar
}

// The username is generated from the digits, so the shape is enforced.
const EMPLOYEE_ID_PATTERN = /^ALT-\d{4}$/;

const BCRYPT_COST = 10; // OWASP Password Storage Cheat Sheet: work factor >= 10
const MIN_PASSWORD_LENGTH = 8;

// 32 random bytes, so 64 hex characters: enough entropy for a fast hash (utils/inviteCode.js).
const INVITE_CODE_BYTES = 32;

// Not specified by the design.
const INVITE_EXPIRY_DAYS = 7;

// ⚠️ The order is the rule: a cycle moves forward one stage at a time through this sequence.
const CYCLE_STAGES = [
  "draft",
  "open",
  "collecting",
  "supervisor_review",
  "normalising",
  "published",
  "closed",
];

// A branch, not a stage, so "advance one stage" can never land on it.
const CYCLE_CANCELLED = "cancelled";

const CYCLE_STATUS = [...CYCLE_STAGES, CYCLE_CANCELLED];

const NEXT_STAGE = CYCLE_STAGES.reduce((map, stage, i) => {
  map[stage] = CYCLE_STAGES[i + 1] || null;
  return map;
}, {});

// ⚠️ Measured from opening, not creation: 30 days from opening falls before anybody has submitted.
const CYCLE_CANCEL_WINDOW_DAYS = 30;

const REVIEWER_TYPES = [
  "self",
  "peer",
  "supervisor",
  "project_lead",
  "team_lead",
  "upward",
];

// ⚠️ Never reach a reviewee or their supervisor with a name on them. The other four are
// attributed on purpose; wrong in either direction is a bug.
const CONFIDENTIAL_REVIEWER_TYPES = ["peer", "upward"];

const REVIEW_STATUS = [
  "pending",
  "in_progress",
  "awaiting_supervisor",
  "normalising",
  "published",
  "acknowledged",
  "withdrawn",
  "under_appeal",
];

// Once published a review is somebody's record; none of these may be published again.
const PUBLISHED_STATES = ["published", "acknowledged", "under_appeal"];

// Reviews received and reviews written in a year are one number: every review has an author.
const PEER_REVIEWS_TARGET = 8;

// Below the minimum HR must acknowledge the shortfall; below the small-pool figure there
// is no colleague section at all.
const PEER_REVIEWS_MINIMUM = 5;
const PEER_REVIEWS_SMALL_POOL = 3;

// Per reviewer, per cycle year across all three groups, and per unit or project.
const REVIEW_LOAD_CEILING = 10;
const REVIEW_LOAD_PER_SOURCE = 5;

const LIST_CHANGE_TYPES = ["add", "remove"];
const LIST_CHANGE_STATUS = ["pending", "approved", "refused"];

// ⚠️ How many settled responses may be read, not how many are asked (the small-pool figure).
const PEER_DISPLAY_THRESHOLD = 3;

// ⚠️ The one test for whether a review has a colleague section at all. Below it there is
// nothing to read, nothing to summarise and nothing to check.
const hasColleagueSection = (assignedCount) => assignedCount >= PEER_DISPLAY_THRESHOLD;

// ⚠️ Four continuous months, not four added up across separate stints.
const PEER_ELIGIBILITY_MONTHS = 4;

// At least this much of the stretch must fall inside the cycle.
const PEER_ELIGIBILITY_MONTHS_IN_CYCLE = 2;

// A break this long or shorter does not end a working relationship.
const PEER_CONTINUITY_GAP_MONTHS = 1;

const FEEDBACK_STATUS = ["assigned", "draft", "submitted", "locked"];

// What HR may record against a colleague summary. A send-back carries a reason; a clearance does not.
const SUMMARY_CHECK_ACTIONS = ["cleared", "sent_back"];

// The author may still edit for this long after submitting; `locksAt` is `submittedAt` plus this.
const FEEDBACK_EDIT_WINDOW_HOURS = 5;

// ⚠️ Stripped from a feedback record served to a reviewee or their supervisor. A
// submission time is an identity, and `locksAt` is that time plus a fixed window.
const IDENTIFYING_FIELDS = [
  "reviewerId",
  "reviewerName",
  "submittedAt",
  "createdAt",
  "updatedAt",
  "locksAt",
  "drawnFrom",
];

// ⚠️ The subset no response may ever carry without an authorised identity read. Kept
// apart because `createdAt` is ordinary on a user or a unit.
const NEVER_SERVED_FIELDS = ["reviewerId", "reviewerName", "drawnFrom"];

// Four shared plus two per job family. ⚠️ Nothing may hardcode the number six, and a
// key must never be renamed or reused: feedback stores `competencyKey`.

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

// A family with no pair gets the shared four: a short review beats one that cannot open.
function competenciesFor(jobFamily) {
  return [...SHARED_COMPETENCIES, ...(FAMILY_COMPETENCIES[jobFamily] || [])];
}

const COMPETENCY_KEYS = [
  ...SHARED_COMPETENCIES.map((c) => c.key),
  ...Object.values(FAMILY_COMPETENCIES).flatMap((list) => list.map((c) => c.key)),
];

// One collection holds both kinds of plan. They share a shape and differ only in their rules.
const PLAN_TYPES = ["PDP", "PIP"];

// ⚠️ The employee's acknowledgement is what moves a plan to active. Nobody approves a
// development plan, so `awaiting_ack` is owned by the employee and not by a reviewer.
const PLAN_STATUS = ["draft", "awaiting_ack", "active", "closed"];

// Required on every action, so the spread of courses against real work is readable.
const PLAN_ACTION_CATEGORIES = [
  "certification",
  "training",
  "mentoring",
  "shadowing",
  "stretch_assignment",
  "taking_ownership",
  "presenting",
  "rotation",
  "leading_work",
  "other",
];

// ⚠️ `overdue` is worked out when a plan is read, from the target date and the state. Nothing
// in this system runs on a schedule, so it is never written.
const PLAN_ACTION_STATUS = [
  "not_started",
  "in_progress",
  "done",
  "overdue",
  "carried_forward",
];

const PLAN_ACTION_OPEN_STATUS = ["not_started", "in_progress", "done"];

const CHECK_IN_OUTCOMES = ["on_track", "at_risk", "off_track"];

// Roughly quarterly, with the next appraisal as the fourth touchpoint. Further check-ins
// beyond these are allowed and shown as additional.
const EXPECTED_CHECK_INS = 3;

const PLAN_OUTCOMES = [
  "completed",
  "carried_forward",
  "not_completed",
  "extended",
  "escalated",
];

const CARRY_FORWARD_REASONS = [
  "employee_capacity",
  "company_workload",
  "no_longer_relevant",
  "blocked_externally",
  "blocked_by_plan_owner",
];

module.exports = {
  ROLES,
  GRANTABLE_ROLES,
  DERIVED_ROLES,
  RESTRICTED_ROLES,
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  AUDIT_REFUSAL_CODES,
  AUDIT_TARGETS,
  MONITORING_FLAG_TYPES,
  MONITORING_FLAG_STATUS,
  REVEAL_THRESHOLD,
  FLAGGED_REFUSAL_CODES,
  ACTIVE_CYCLE_STAGES,
  WATCHED_HISTORY_TARGETS,
  ROLE_PRECEDENCE,
  USER_STATUS,
  LOCATIONS,
  ORG_UNIT_TYPES,
  HR_COVERAGE_ROLES,
  HR_OFFICER_ROLES,
  JOB_FAMILIES,
  DESIGNATIONS,
  DESIGNATION_NAMES,
  PAR_GROUPS,
  parGroupFor,
  SHARED_COMPETENCIES,
  FAMILY_COMPETENCIES,
  competenciesFor,
  COMPETENCY_KEYS,
  PLAN_TYPES,
  PLAN_STATUS,
  PLAN_ACTION_CATEGORIES,
  PLAN_ACTION_STATUS,
  PLAN_ACTION_OPEN_STATUS,
  CHECK_IN_OUTCOMES,
  EXPECTED_CHECK_INS,
  PLAN_OUTCOMES,
  CARRY_FORWARD_REASONS,
  CYCLE_STAGES,
  CYCLE_STATUS,
  CYCLE_CANCELLED,
  NEXT_STAGE,
  CYCLE_CANCEL_WINDOW_DAYS,
  REVIEWER_TYPES,
  CONFIDENTIAL_REVIEWER_TYPES,
  FEEDBACK_STATUS,
  SUMMARY_CHECK_ACTIONS,
  REVIEW_STATUS,
  PUBLISHED_STATES,
  PEER_REVIEWS_TARGET,
  PEER_REVIEWS_MINIMUM,
  PEER_REVIEWS_SMALL_POOL,
  REVIEW_LOAD_CEILING,
  REVIEW_LOAD_PER_SOURCE,
  LIST_CHANGE_TYPES,
  LIST_CHANGE_STATUS,
  PEER_DISPLAY_THRESHOLD,
  hasColleagueSection,
  PEER_ELIGIBILITY_MONTHS,
  PEER_ELIGIBILITY_MONTHS_IN_CYCLE,
  PEER_CONTINUITY_GAP_MONTHS,
  FEEDBACK_EDIT_WINDOW_HOURS,
  IDENTIFYING_FIELDS,
  NEVER_SERVED_FIELDS,
  EMPLOYEE_ID_PATTERN,
  BCRYPT_COST,
  MIN_PASSWORD_LENGTH,
  INVITE_CODE_BYTES,
  INVITE_EXPIRY_DAYS,
};
