import * as yup from "yup";

// If the constants request failed the list check is skipped: the server has the final word.
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

    // Wide on purpose: a backfilled year is allowed.
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
      .test(
        "after-start",
        "The end date must be after the start date",
        (value, context) =>
          !value || !context.parent.startDate || value > context.parent.startDate,
      ),
  });
};
