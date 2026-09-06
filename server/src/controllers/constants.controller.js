const asyncHandler = require("../utils/asyncHandler");
const {
  GRANTABLE_ROLES,
  ROLE_PRECEDENCE,
  USER_STATUS,
  LOCATIONS,
  JOB_FAMILIES,
  DESIGNATIONS,
  DESIGNATION_NAMES,
  ORG_UNIT_TYPES,
  HR_COVERAGE_ROLES,
  HR_OFFICER_ROLES,
  PAR_GROUPS,
  competenciesFor,
  EMPLOYEE_ID_PATTERN,
  MIN_PASSWORD_LENGTH,
} = require("../config/constants");

// Only the people who build an employee record need the vocabulary for creating one.
// Admin is deliberately absent rather than forgotten.
const RECORD_MANAGING_ROLES = ["hr", "head_of_hr"];

// Only the Head of HR builds the tree, so only they need a type dropdown.
const TREE_MANAGING_ROLES = ["head_of_hr"];

// Same roles as TREE_MANAGING_ROLES today, kept as its own name because the two are
// separate decisions that only happen to agree right now.
const COVERAGE_MANAGING_ROLES = ["head_of_hr"];

// Serves the controlled lists so a dropdown and a Yup schema come from the SAME source
// the model validates against. A copy in client code drifts silently: the form offers
// an option the server then rejects with a 400 nobody can explain.
//
// ⚠️ `supervisor` is absent from `roles` because it cannot be granted. The employee-ID
// pattern and password minimum go only to roles that create accounts.
exports.getConstants = asyncHandler(async (req, res) => {
  const held = req.user?.roles || [];
  const managesRecords = held.some((role) => RECORD_MANAGING_ROLES.includes(role));
  const managesTree = held.some((role) => TREE_MANAGING_ROLES.includes(role));
  const managesCoverage = held.some((role) => COVERAGE_MANAGING_ROLES.includes(role));

  const payload = {
    designations: DESIGNATION_NAMES.map((name) => ({
      name,
      jobFamily: DESIGNATIONS[name],
    })),
    jobFamilies: JOB_FAMILIES,
    locations: LOCATIONS,
    // Two copies of this drift, and a drifted one is invisible: the user simply lands
    // somewhere unexpected.
    rolePrecedence: ROLE_PRECEDENCE,

    // Pre-composed per family rather than joined on the client, which would be the
    // same rule written twice. Every family goes to every user: reviewing somebody in
    // another family needs the REVIEWEE's set.
    //
    // ⚠️ NOTHING READING THIS MAY ASSUME SIX. Read the array's length.
    competencies: Object.fromEntries(
      JOB_FAMILIES.map((family) => [family, competenciesFor(family)]),
    ),
  };

  if (managesRecords) {
    payload.roles = GRANTABLE_ROLES;
    payload.statuses = USER_STATUS;
    payload.rules = {
      employeeIdPattern: EMPLOYEE_ID_PATTERN.source,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    };

    // Everywhere else parGroup is derived from a joining date, never chosen.
    payload.parGroups = PAR_GROUPS;
  }

  if (managesTree) {
    payload.orgUnitTypes = ORG_UNIT_TYPES;
  }

  if (managesCoverage) {
    payload.hrCoverageRoles = HR_COVERAGE_ROLES;
    // Who the candidate picker offers when assigning coverage -- the same vocabulary
    // the server enforces in hrcoverage.service.js, so the picker cannot offer someone
    // the server would then refuse.
    payload.hrOfficerRoles = HR_OFFICER_ROLES;
  }

  res.json(payload);
});
