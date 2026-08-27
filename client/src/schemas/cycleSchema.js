import * as yup from "yup";

// `parGroups` comes from GET /api/constants: a list written twice drifts, and the
// drift is silent, because the dropdown offers a word the model refuses. If that
// request failed the list check is skipped, as in the unit and employee schemas.
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

    // Wide on purpose. Which years are sensible is not written down anywhere, so this
    // catches a typo and leaves a deliberately backfilled year alone.
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
      // A period ending before it starts covers no days, so the record is true on no
      // date. The server refuses it too; this only says so first.
      .test(
        "after-start",
        "The end date must be after the start date",
        (value, context) =>
          !value || !context.parent.startDate || value > context.parent.startDate,
      ),
  });
};
