import * as yup from "yup";

// Shape only. Every rule about other records lives on the server.

export const moveSchema = yup.object({
  unitId: yup.string().required("Choose a unit"),
  from: yup.string().required("Choose the date this takes effect"),
});

export const appointLeadSchema = yup.object({
  userId: yup.string().required("Choose who leads this unit"),
  from: yup.string().required("Choose the date they take over"),
});

// No default: prefilling today would guess at the one fact being recorded.
export const discontinueSchema = yup.object({
  lastDay: yup.string().required("Give the last day this unit operated"),
});

// `role` is fixed by which button opened the form, not typed.
export const assignCoverageSchema = yup.object({
  userId: yup.string().required("Choose who covers this unit"),
  from: yup.string().required("Choose the date they take over"),
});
