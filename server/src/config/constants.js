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

// ---------------------------------------------------------------------------
// Account status
// ---------------------------------------------------------------------------
// Three states, not a boolean: a boolean cannot tell "invited but never activated"
// apart from "no longer works here", and those need different handling.
const USER_STATUS = ["invited", "active", "inactive"];

const LOCATIONS = ["Colombo"];

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

module.exports = {
  ROLES,
  GRANTABLE_ROLES,
  DERIVED_ROLES,
  USER_STATUS,
  LOCATIONS,
  JOB_FAMILIES,
  DESIGNATIONS,
  DESIGNATION_NAMES,
  PAR_GROUPS,
  parGroupFor,
  EMPLOYEE_ID_PATTERN,
  BCRYPT_COST,
  MIN_PASSWORD_LENGTH,
};
