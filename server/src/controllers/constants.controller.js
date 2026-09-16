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

// Admin is deliberately absent.
const RECORD_MANAGING_ROLES = ["hr", "head_of_hr"];
const TREE_MANAGING_ROLES = ["head_of_hr"];

// Its own name: a separate decision that only happens to agree with the tree today.
const COVERAGE_MANAGING_ROLES = ["head_of_hr"];

// The lists a dropdown and a Yup schema are built from, so neither can drift from the model.
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
    rolePrecedence: ROLE_PRECEDENCE,

    // Every family goes to every user: a reviewer needs the reviewee's set.
    // ⚠️ Nothing reading this may assume six. Read the array's length.
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

    payload.parGroups = PAR_GROUPS;
  }

  if (managesTree) {
    payload.orgUnitTypes = ORG_UNIT_TYPES;
  }

  if (managesCoverage) {
    payload.hrCoverageRoles = HR_COVERAGE_ROLES;
    payload.hrOfficerRoles = HR_OFFICER_ROLES;
  }

  res.json(payload);
});
