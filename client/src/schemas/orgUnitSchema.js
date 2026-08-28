import * as yup from "yup";

// `orgUnitTypes` comes from GET /api/constants so the dropdown and the model cannot
// offer different words. The server only sends it to the Head of HR, who is the only
// role reaching this form. If that request failed the list check is skipped: a form
// refusing every value because a side request failed is worse than letting the server
// have the final word, which it has regardless.

// `hasRoot` decides whether a parent is required. The first unit created is the
// company and may have none; every unit after it needs one, or the company becomes
// two disconnected trees and "who is my supervisor" stops having one answer.
export const buildUnitSchema = (constants, { hasRoot } = {}) => {
  const types = constants?.orgUnitTypes || [];

  return yup.object({
    name: yup.string().trim().required("Name is required"),

    type: yup
      .string()
      .required("Type is required")
      .test(
        "in-list",
        "Choose a type from the list",
        (value) => !value || types.length === 0 || types.includes(value),
      ),

    parentUnitId: hasRoot
      ? yup.string().required("Choose where this unit sits")
      : yup.string().nullable(),
  });
};
