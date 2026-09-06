import * as yup from "yup";

// These only stop an empty or self-contradictory form being sent. Every rule that
// matters -- the assignment falling inside its project, one team lead at a time, an
// overlap on the same project, and whether this HR officer covers this person on this
// date -- is about OTHER records and lives on the server, where it cannot be bypassed.
//
// ⚠️ Unlike the unit and cycle schemas these take no `constants`: PDT-22 added no
// controlled list, so there is no server vocabulary for a project form to mirror.
//
// ⚠️ EVERY END DATE HERE IS AN INCLUSIVE LAST WORKING DAY, which is what HR types and
// what these tests compare. It becomes the API's exclusive `to` at the call site, via
// dayAfter(). That is why "equal to the start" is allowed below and would be wrong if
// these fields were the stored value: a stint that starts and ends on the same day is
// one day of work, not none.

export const createProjectSchema = yup.object({
  name: yup.string().trim().required("Give the project a name"),
  leadId: yup.string().required("Choose who leads this project"),
  startDate: yup.string().required("Choose the date it starts"),
});

export const assignmentSchema = yup.object({
  userId: yup.string().required("Choose who is joining"),
  from: yup.string().required("Choose the date they join"),

  // Optional: left blank for ongoing work. A one-day assignment is real, so the same
  // day as the start is allowed.
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

// Required with no default, for the reason discontinuing a unit has none: a project
// closing is a dated decision somebody made, and prefilling today would guess at the
// one fact being recorded.
export const closeProjectSchema = yup.object({
  lastDay: yup.string().required("Give the last day the project ran"),
});

export const teamLeadSchema = yup.object({
  from: yup.string().required("Choose the date they take over"),
});

// The period the team screen asks about. Both ends inclusive, so a single day is a
// legitimate search and `from` may equal the last day.
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
