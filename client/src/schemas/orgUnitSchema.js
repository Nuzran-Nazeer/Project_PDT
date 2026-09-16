import * as yup from "yup";

// `orgUnitTypes` goes only to the Head of HR; an HR officer's form fixes the type. If the
// list is missing the check is skipped: the server has the final word.
// `hasRoot`: only the first unit created may have no parent.
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
