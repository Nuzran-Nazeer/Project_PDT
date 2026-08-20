const asyncHandler = require("../utils/asyncHandler");
const {
  GRANTABLE_ROLES,
  ROLE_PRECEDENCE,
  USER_STATUS,
  LOCATIONS,
  JOB_FAMILIES,
  DESIGNATIONS,
  DESIGNATION_NAMES,
  EMPLOYEE_ID_PATTERN,
  MIN_PASSWORD_LENGTH,
} = require("../config/constants");

// The controlled lists, served to the client so a dropdown and a Yup schema can be
// built from the SAME source the model validates against.
//
// The alternative — copying the lists into client code — drifts the first time HR
// adds a designation, and drifts silently: the form offers an option the server
// then rejects with a 400 nobody can explain.
//
// `designations` carries the job family with each name, so the form can show the
// family beside the dropdown without a second request. It is display only —
// jobFamily is derived on the server and ignored if a client sends it.
//
// DERIVED_ROLES is deliberately absent. `supervisor` cannot be granted, so offering
// it in a role picker would build a form whose value the server refuses.
exports.getConstants = asyncHandler(async (req, res) => {
  res.json({
    designations: DESIGNATION_NAMES.map((name) => ({
      name,
      jobFamily: DESIGNATIONS[name],
    })),
    jobFamilies: JOB_FAMILIES,
    locations: LOCATIONS,
    roles: GRANTABLE_ROLES,
    // The landing order, so the client picks the same dashboard the server would.
    // Kept here rather than hardcoded in React: two copies of an ordering drift, and
    // a drifted one is invisible — the user simply lands somewhere unexpected.
    rolePrecedence: ROLE_PRECEDENCE,
    statuses: USER_STATUS,
    rules: {
      employeeIdPattern: EMPLOYEE_ID_PATTERN.source,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
  });
});
