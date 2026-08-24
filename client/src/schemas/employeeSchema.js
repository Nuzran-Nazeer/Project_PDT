import * as yup from "yup";

// Built from the server's own lists rather than typed here.
//
// Both schemas are FUNCTIONS taking the payload from GET /api/constants, because
// the valid designations, locations, roles and the employee-ID pattern are the
// server's to decide. Hardcoding them would drift the first time HR adds a
// designation, and drift silently: the form would offer an option the server then
// rejects with a 400 nobody can explain.
//
// If the constants request failed, `constants` is null and each list check is
// skipped. That is deliberate — a form that refuses every value because a side
// request failed is worse than one that lets the server have the final word, which
// it has regardless.

const names = (list) => (list || []).map((entry) => entry.name ?? entry);

const idPattern = (constants) => {
  const source = constants?.rules?.employeeIdPattern;
  return source ? new RegExp(source) : null;
};

const optionalIn = (list, message) =>
  yup.string().test("in-list", message, (value) => !value || list.includes(value));

// Fields only settable at creation. `employeeId` and `joinedDate` are immutable on
// the server: the username is generated from the ID's digits, and the joined date
// decides the appraisal group, which must never move once set.
export const buildCreateEmployeeSchema = (constants) => {
  const pattern = idPattern(constants);
  const designations = names(constants?.designations);
  const locations = constants?.locations || [];
  const roles = constants?.roles || [];

  return yup.object({
    employeeId: yup
      .string()
      .trim()
      .required("Employee ID is required")
      .test(
        "shape",
        "Employee ID must look like ALT-0241",
        (value) => !pattern || !value || pattern.test(value.toUpperCase()),
      ),
    name: yup.string().trim().required("Name is required"),
    email: yup
      .string()
      .trim()
      .email("Enter a valid email address")
      .required("Email is required"),
    joinedDate: yup
      .date()
      .typeError("Enter a valid date")
      .required("Joined date is required"),
    // Blank is allowed: not everyone is on probation, and the field is optional on
    // the server too. When it is given it cannot precede the joined date.
    probationEndDate: yup
      .date()
      .nullable()
      .transform((value, original) => (original === "" ? null : value))
      .min(yup.ref("joinedDate"), "Probation cannot end before the joined date"),
    designation: optionalIn(designations, "Choose a designation from the list"),
    level: yup.string().trim(),
    location: optionalIn(locations, "Choose a location from the list"),
    roles: yup
      .array()
      .of(yup.string().oneOf(roles.length ? roles : undefined))
      .min(1, "Every record holds at least the employee role"),
  });
};

// Deliberately narrower. The server refuses to change employeeId, username,
// joinedDate and parGroup, so offering them here would only produce a 400 the user
// cannot act on.
export const buildUpdateEmployeeSchema = (constants) => {
  const designations = names(constants?.designations);
  const locations = constants?.locations || [];
  const roles = constants?.roles || [];
  const statuses = constants?.statuses || [];

  return yup.object({
    name: yup.string().trim().required("Name is required"),
    email: yup
      .string()
      .trim()
      .email("Enter a valid email address")
      .required("Email is required"),
    probationEndDate: yup
      .date()
      .nullable()
      .transform((value, original) => (original === "" ? null : value)),
    designation: optionalIn(designations, "Choose a designation from the list"),
    level: yup.string().trim(),
    location: optionalIn(locations, "Choose a location from the list"),
    roles: yup
      .array()
      .of(yup.string().oneOf(roles.length ? roles : undefined))
      .min(1, "Every record holds at least the employee role"),
    status: optionalIn(statuses, "Choose a status from the list"),
  });
};
