import * as yup from "yup";

// Both forms are two fields, and neither has a controlled list behind it — the unit
// and the person are picked from what the server sent, so there is nothing to check
// against `/api/constants` the way the employee and unit forms do.
//
// Every rule that actually matters here lives on the server and cannot live
// anywhere else: one open membership at a time, a move dated after the stint it
// ends, a lead who belonged to the unit above. All three are about OTHER records,
// so the client cannot know them. These schemas only stop an empty form being sent.

export const moveSchema = yup.object({
  unitId: yup.string().required("Choose a unit"),
  from: yup.string().required("Choose the date this takes effect"),
});

export const appointLeadSchema = yup.object({
  userId: yup.string().required("Choose who leads this unit"),
  from: yup.string().required("Choose the date they take over"),
});

// One field, and it is required with no default. A unit closing is a dated event
// somebody decided on, so there is no sensible value to prefill: today would be a
// guess, and this is the one fact the story exists to record honestly.
export const discontinueSchema = yup.object({
  lastDay: yup.string().required("Give the last day this unit operated"),
});
