import * as yup from "yup";

// The create-a-cycle form.
//
// `parGroups` comes from GET /api/constants rather than being typed here, for the same
// reason every other schema does it: a list written twice drifts, and a drifted list
// fails silently — the dropdown offers a word the model will refuse.
//
// If the constants request failed the list check is skipped, which is the same choice
// the unit and employee schemas make. A form that refuses every value because a side
// request failed is worse than one that lets the server have the final word, which it
// has regardless.
export const buildCycleSchema = (constants) => {
  const groups = constants?.parGroups || [];
  const thisYear = new Date().getFullYear();

  return yup.object({
    parGroup: yup
      .string()
      .required("Choose an appraisal group")
      .test(
        "in-list",
        "Choose a group from the list",
        (value) => !value || groups.length === 0 || groups.includes(value),
      ),

    // A window rather than an open number, and a wide one. Which years are sensible is
    // not written down anywhere, so this only catches a typo — 2O26 or 20226 — and
    // leaves a deliberately backfilled year alone.
    year: yup
      .number()
      .typeError("Year must be a number")
      .integer("Year must be a whole number")
      .min(thisYear - 5, `Year cannot be before ${thisYear - 5}`)
      .max(thisYear + 5, `Year cannot be after ${thisYear + 5}`)
      .required("Year is required"),

    startDate: yup.string().required("Start date is required"),

    endDate: yup
      .string()
      .required("End date is required")
      // A period that ends before it starts covers no days at all, which is a record
      // that is true on no date. The server refuses it too; this only says so first.
      .test(
        "after-start",
        "The end date must be after the start date",
        (value, context) =>
          !value || !context.parent.startDate || value > context.parent.startDate,
      ),
  });
};
