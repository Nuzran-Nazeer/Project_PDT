import * as yup from "yup";

// Shape only. Every rule about other records lives on the server.
// ⚠️ Every end date here is an inclusive last working day, converted to the API's
// exclusive `to` at the call site with dayAfter(). That is why equal to the start is allowed.

export const createProjectSchema = yup.object({
  name: yup.string().trim().required("Give the project a name"),
  leadId: yup.string().required("Choose who leads this project"),
  startDate: yup.string().required("Choose the date it starts"),
});

export const assignmentSchema = yup.object({
  userId: yup.string().required("Choose who is joining"),
  from: yup.string().required("Choose the date they join"),

  // Blank for ongoing work.
  lastDay: yup
    .string()
    .test(
      "not-before-start",
      "The last working day cannot be before the day they join",
      (value, context) => !value || !context.parent.from || value >= context.parent.from,
    ),
});

export const closeAssignmentSchema = yup.object({
  lastDay: yup.string().required("Give their last working day on this project"),
});

// No default: prefilling today would guess at the one fact being recorded.
export const closeProjectSchema = yup.object({
  lastDay: yup.string().required("Give the last day the project ran"),
});

export const teamLeadSchema = yup.object({
  from: yup.string().required("Choose the date they take over"),
});

// Both ends inclusive, so `from` may equal the last day.
export const teamPeriodSchema = yup.object({
  from: yup.string().required("Choose the first day of the period"),
  lastDay: yup
    .string()
    .required("Choose the last day of the period")
    .test(
      "not-before-from",
      "The last day cannot be before the first day",
      (value, context) => !value || !context.parent.from || value >= context.parent.from,
    ),
});
