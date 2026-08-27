// Controlled lists the User model validates against.
//
// Nothing outside this file types one of these strings. A typo'd role or designation
// written inline is a silent bug; imported from here it is `undefined` and fails loudly.

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
// Six roles exist, but they do not all reach the database.
//
// `supervisor` is DERIVED, never stored: you are a supervisor because you lead a
// unit on a given date, which is read from the unit-lead history. Storing it would
// go stale the moment someone moves, and every rule in this system is about a period.
//
// So the User record holds only the roles a person is GRANTED.
const GRANTABLE_ROLES = ["employee", "hr", "head_of_hr", "leadership", "admin"];
const DERIVED_ROLES = ["supervisor"];
const ROLES = [...GRANTABLE_ROLES, ...DERIVED_ROLES];

// Which dashboard a multi-role user lands on after signing in: the first role in
// this list that they hold. It is a ROUTING order, not seniority — the question it
// answers is "which screen is most useful to this person", not who outranks whom.
//
// Head of HR is first as the neutral backstop with the widest view. `employee` is
// last because everyone holds it, so it is the fallback that always matches.
// `leadership` sits mid-list only because its position is immaterial: leadership is
// the top of the chain, is not necessarily appraised, and does not hold a list of
// other roles alongside it.  (Build decision B7)
//
// `supervisor` is here but UNREACHABLE until the org structure exists — it is
// derived from who leads a unit on a date and is deliberately absent from the token.
const ROLE_PRECEDENCE = [
  "head_of_hr",
  "hr",
  "leadership",
  "admin",
  "supervisor",
  "employee",
];

// ---------------------------------------------------------------------------
// Account status
// ---------------------------------------------------------------------------
// Three states, not a boolean: a boolean cannot tell "invited but never activated"
// apart from "no longer works here", and those need different handling.
const USER_STATUS = ["invited", "active", "inactive"];

const LOCATIONS = ["Colombo"];

// ---------------------------------------------------------------------------
// Org unit types
// ---------------------------------------------------------------------------
// "team" is deliberately NOT here. In this system a team means only the slice of one
// unit allocated to one project — it is derived from project assignments, never
// stored, and never appears in the org tree.  (System spec §0.1)
//
// These are LABELS, not depths. Nothing checks that a sub-unit sits under a unit,
// because the tree is recursive by design: the spec expects it to grow to five levels
// without a rewrite, and three type names cannot describe five levels. Enforcing
// type-by-depth would be inventing a rule the design does not have.
const ORG_UNIT_TYPES = ["company", "unit", "sub-unit"];

// ---------------------------------------------------------------------------
// Designation -> job family
// ---------------------------------------------------------------------------
// The review form is chosen by JOB FAMILY, not designation — otherwise 33 designations
// would mean 33 form templates nobody maintains. HR can add a designation without
// anyone building a form.  (System spec §0.6)
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

// ---------------------------------------------------------------------------
// Appraisal (PAR) groups
// ---------------------------------------------------------------------------
// Everyone is appraised in one of three annual waves, decided by the month they
// joined. Set ONCE at creation and never moved afterwards — moving someone between
// groups changes which cycle their history belongs to.
const PAR_GROUPS = ["April", "August", "December"];

// Joining month (0 = January) -> group.
//   December–March  -> April
//   April–July      -> August
//   August–November -> December
function parGroupFor(joinedDate) {
  if (!joinedDate) return undefined;
  const month = new Date(joinedDate).getMonth();
  if (month >= 3 && month <= 6) return "August"; // Apr–Jul
  if (month >= 7 && month <= 10) return "December"; // Aug–Nov
  return "April"; // Dec–Mar
}

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------
// The username is generated from this ID's digits, so the ID's shape is enforced:
// `ALT-0241` and `A-0241` would otherwise both be valid and generate one username.
const EMPLOYEE_ID_PATTERN = /^ALT-\d{4}$/;

const BCRYPT_COST = 10; // OWASP Password Storage Cheat Sheet: work factor >= 10
const MIN_PASSWORD_LENGTH = 8;

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------
// The activation code HR hands a new joiner. 32 random bytes -> 64 hex characters,
// which is what allows it to be stored as a fast hash rather than a slow one.
// See utils/inviteCode.js for that reasoning.
const INVITE_CODE_BYTES = 32;

// How long a code stays usable. Long enough to survive a weekend plus a first day
// of onboarding, short enough that a forgotten invite is not left open for a month.
// NOT specified by the design documents — chosen here, 2026-08-23, and one line to change.
const INVITE_EXPIRY_DAYS = 7;

// ---------------------------------------------------------------------------
// Appraisal cycle stages
// ---------------------------------------------------------------------------
// THE ORDER IS THE RULE. A cycle moves forward one stage at a time and never
// backwards, so the sequence below is not documentation -- it is what the service
// checks a requested move against. Spec §2.10, LOCKED.
const CYCLE_STAGES = [
  "draft",
  "open",
  "collecting",
  "supervisor_review",
  "normalising",
  "published",
  "closed",
];

// Cancelled is deliberately NOT in that list. It is not a stage a cycle passes
// through; it is a branch off the early life of one, and a cancelled cycle goes
// nowhere afterwards. Keeping it out of the sequence is what stops "advance one
// stage" ever landing on it by accident.
const CYCLE_CANCELLED = "cancelled";

const CYCLE_STATUS = [...CYCLE_STAGES, CYCLE_CANCELLED];

// The next stage after each one, or null where there is nowhere to go.
const NEXT_STAGE = CYCLE_STAGES.reduce((map, stage, i) => {
  map[stage] = CYCLE_STAGES[i + 1] || null;
  return map;
}, {});

// How long after OPENING a cycle may still be cancelled. Spec §2.9, LOCKED.
//
// Measured from opening, not from creation: everything in a cycle happens at its end
// (§2.1), so 30 days is guaranteed to fall before anybody has submitted anything and
// no work is ever destroyed by a cancellation. That guarantee is the whole reason the
// figure is what it is, and it only holds if the clock starts when the cycle opens.
const CYCLE_CANCEL_WINDOW_DAYS = 30;

// ---------------------------------------------------------------------------
// Competencies
// ---------------------------------------------------------------------------
//
// SIX PER REVIEW: four shared by everyone, plus two for the reviewee's job family.
//
// ⚠️ NOTHING MAY HARDCODE THE NUMBER SIX. It is a locked rule (spec L1-1) and it is
// the reason this list lives here. Anything that iterates competencies reads the list;
// anything that averages divides by what it actually FOUND, never by a literal.
// Changing this list should cost an edit to this file and nothing else -- if it ever
// costs more, something has been hardcoded that should not have been.
//
// THE KEY IS THE IDENTITY, NEVER THE NAME. Feedback stores `competencyKey`, so
// renaming a competency leaves every stored record meaning exactly what it meant. A
// key must never be reused for a different competency, and never renamed.
//
// WHERE THIS LIST COMES FROM. Vimukthi's research,
// `Deliverables/PDT-COMPETENCY-FRAMEWORK-DECISION.md`, reconciled with the locked
// design on 2026-08-27 and confirmed by Nuzran. Her framework is 3 core plus 4-5 per
// family (7-8 per review); the design locks 4 shared plus 2, which is six. Six was
// kept, and her own sizing evidence supports it once the MULTIPLIER is applied: her
// guidance caps a rater at 15-25 items, and a person here writes 8 colleague reviews
// a year plus their own self-assessment. Six competencies over nine forms is already
// 54 ratings and 54 written paragraphs; eight would be 72 of each, and the evidence
// boxes would fill with "good work".
//
// Three of her findings changed the design's own pairs, and each is an improvement:
//   . `problem solving` was Engineering's, and she found it recurs in six of seven
//     families -- which makes it a poor FAMILY-SPECIFIC competency.
//   . `stakeholder management` was Analysis & Product's, and it overlaps the shared
//     collaboration competency.
//   . `facilitation` was Delivery's, and it overlaps it too.
//
// ⚠️ DATA IS NOT RESEARCH-BACKED. Her document covers seven job families and ours has
// eight; Data is the gap. That pair is inherited from the design and is a declared
// hole, not a quietly filled one.

// Rated for everyone, whatever they do. These four carry cross-family comparison, so
// they must read identically for an engineer, a tester and an HR officer.
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

// The pair that says something about the actual job. Keyed by job family, which is
// itself derived from designation -- so nobody picks their own form.
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
  // ⚠️ The one pair with no research behind it. See the note above.
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
    // Her research flags this as critical in a system of this kind, which is the
    // client's headline requirement stated as a competency.
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

// The whole form for one job family, in the order it is asked: shared first, then the
// pair. Returns the SHARED FOUR ALONE for a family that has no pair, rather than
// throwing -- somebody whose designation is missing still has four things that can be
// asked about them, and a review that is short beats one that cannot open.
function competenciesFor(jobFamily) {
  return [...SHARED_COMPETENCIES, ...(FAMILY_COMPETENCIES[jobFamily] || [])];
}

// Every key in use, for checking a submitted rating against something real. Built from
// the lists rather than typed out, so it cannot fall behind them.
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
  EMPLOYEE_ID_PATTERN,
  BCRYPT_COST,
  MIN_PASSWORD_LENGTH,
  INVITE_CODE_BYTES,
  INVITE_EXPIRY_DAYS,
};
