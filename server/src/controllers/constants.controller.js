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
  PAR_GROUPS,
  competenciesFor,
  EMPLOYEE_ID_PATTERN,
  MIN_PASSWORD_LENGTH,
} = require("../config/constants");

// Who gets the extra half of this payload. Only the people who build an employee
// record need the vocabulary for creating one. Leadership reads the roster but
// never writes to it, so it is not here.
//
// Admin is deliberately absent rather than forgotten: the three Administrator
// stories are drafted and NOT agreed, so what an administrator needs is not yet
// decided. Add them when it is, rather than guessing now.
const RECORD_MANAGING_ROLES = ["hr", "head_of_hr"];

// Who gets the unit-type vocabulary. Only the Head of HR builds the tree, so only
// the Head of HR needs a type dropdown — HR and Leadership read the tree, and a
// reader gets the type off the record itself rather than needing the list.
const TREE_MANAGING_ROLES = ["head_of_hr"];

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
// DERIVED_ROLES is deliberately absent from `roles`. `supervisor` cannot be
// granted, so offering it in a role picker would build a form whose value the
// server refuses.
//
// THE RESPONSE IS SCOPED BY ROLE. Everyone signed in gets the vocabulary their own
// screens need to render. The employee-ID pattern and the password minimum go only
// to the roles that create accounts — they are no use to an employee, and they are
// the two entries here that would help someone construct a plausible employee ID or
// narrow a password guess. Small, but there is no reason to hand them out.
exports.getConstants = asyncHandler(async (req, res) => {
  const held = req.user?.roles || [];
  const managesRecords = held.some((role) => RECORD_MANAGING_ROLES.includes(role));
  const managesTree = held.some((role) => TREE_MANAGING_ROLES.includes(role));

  const payload = {
    designations: DESIGNATION_NAMES.map((name) => ({
      name,
      jobFamily: DESIGNATIONS[name],
    })),
    jobFamilies: JOB_FAMILIES,
    locations: LOCATIONS,
    // The landing order, so the client picks the same dashboard the server would.
    // Kept here rather than hardcoded in React: two copies of an ordering drift, and
    // a drifted one is invisible — the user simply lands somewhere unexpected.
    // Everyone needs it: it is what decides where they land after signing in.
    rolePrecedence: ROLE_PRECEDENCE,

    // The competency set, PRE-COMPOSED per job family: the shared four plus that
    // family's pair, in the order they are asked.
    //
    // COMPOSED HERE RATHER THAN ON THE CLIENT, deliberately. Serving the shared four
    // and the family pairs separately would mean React joining them itself, which is
    // the same rule written twice -- and the second copy is the one that drifts when
    // the order or the split changes.
    //
    // EVERY FAMILY GOES TO EVERY SIGNED-IN USER, not just the reader's own. A peer
    // reviewing somebody in another family needs the REVIEWEE's set, not their own,
    // and so does a supervisor -- so an endpoint serving only your own would leave
    // both forms unable to render. There is nothing to protect here: it is the
    // vocabulary of the appraisal, not anybody's data.
    //
    // ⚠️ NOTHING READING THIS MAY ASSUME SIX. Read the array's length; never a literal.
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

    // The three appraisal groups, for the cycle form. Scoped the same way as the rest
    // of this block because HR and the Head of HR are exactly who may create a cycle.
    // Nobody else has a form that needs the list: parGroup is DERIVED from a joining
    // date on every other screen, never chosen.
    payload.parGroups = PAR_GROUPS;
  }

  if (managesTree) {
    payload.orgUnitTypes = ORG_UNIT_TYPES;
  }

  res.json(payload);
});
