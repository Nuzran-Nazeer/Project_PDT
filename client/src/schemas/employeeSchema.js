import * as yup from "yup";

// Functions taking the payload from GET /api/constants, because the valid values are
// the server's to decide. Hardcoding them drifts silently: the form offers an option
// the server rejects with a 400 nobody can explain.
//
// If that request failed, `constants` is null and each list check is skipped, letting
// the server have the final word, which it has regardless.

const names = (list) => (list || []).map((entry) => entry.name ?? entry);

const idPattern = (constants) => {
  const source = constants?.rules?.employeeIdPattern;
  return source ? new RegExp(source) : null;
};

const optionalIn = (list, message) =>
  yup.string().test("in-list", message, (value) => !value || list.includes(value));

// Settable only at creation: `employeeId` and `joinedDate` are immutable on the
// server, the joined date deciding the appraisal group.
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
    // Optional on the server too. When given it cannot precede the joined date.
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

// Narrower: the server refuses to change employeeId, username, joinedDate and
// parGroup, so offering them produces a 400 the user cannot act on.
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
