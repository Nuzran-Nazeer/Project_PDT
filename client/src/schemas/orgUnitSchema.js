import * as yup from "yup";

// Built from the server's own list rather than typed here, for the same reason the
// employee schema is: `orgUnitTypes` comes from GET /api/constants, so the dropdown
// and the model can never offer different words.
//
// The constants payload only carries `orgUnitTypes` for the Head of HR — HR and
// Leadership read the tree and never need a type picker, so the server does not send
// them one. That is fine here, because only the Head of HR ever reaches this form.
//
// If the constants request failed, `orgUnitTypes` is undefined and the list check is
// skipped. Deliberate, and the same choice the employee schema makes: a form that
// refuses every value because a side request failed is worse than one that lets the
// server have the final word, which it has regardless.

// `hasRoot` decides whether a parent is required. The FIRST unit created is the
// company and is allowed to have none; every unit after it needs one, or the company
// becomes two disconnected trees and "who is my supervisor" stops having one answer.
// The server refuses either mistake — this only means the form says so first.
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
