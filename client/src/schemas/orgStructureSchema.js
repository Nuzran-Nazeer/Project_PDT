import * as yup from "yup";

// These only stop an empty form being sent. Every rule that matters (one open
// membership at a time, a move dated after the stint it ends, a lead who belonged to
// the unit above) is about OTHER records, so it lives on the server and cannot live
// anywhere else.

export const moveSchema = yup.object({
  unitId: yup.string().required("Choose a unit"),
  from: yup.string().required("Choose the date this takes effect"),
});

export const appointLeadSchema = yup.object({
  userId: yup.string().required("Choose who leads this unit"),
  from: yup.string().required("Choose the date they take over"),
});

// Required with no default: a unit closing is a dated event somebody decided on, so
// prefilling today would guess at the one fact being recorded.
export const discontinueSchema = yup.object({
  lastDay: yup.string().required("Give the last day this unit operated"),
});

// `role` (primary or backup) is not a form field: it is fixed by which button opened
// the form, the same way it is not asked for on this schema's server-side twin.
export const assignCoverageSchema = yup.object({
  userId: yup.string().required("Choose who covers this unit"),
  from: yup.string().required("Choose the date they take over"),
});
