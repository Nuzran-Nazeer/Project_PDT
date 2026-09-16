import * as yup from "yup";

// ⚠️ Built from the competencies served with the record, never from constants: a peer
// answers for the reviewee's job family. Only checked before submit; a draft may be partial.
export const buildPeerReviewSchema = (competencies = []) =>
  yup.object({
    ratings: yup
      .array()
      .of(
        yup.object({
          competencyKey: yup.string().required(),
          notObserved: yup.boolean().default(false),
          // Declining stores neither a score nor evidence.
          score: yup
            .number()
            .nullable()
            .integer("Score must be a whole number")
            .min(1, "Score must be from 1 to 5")
            .max(5, "Score must be from 1 to 5")
            .when("notObserved", {
              is: false,
              then: (schema) => schema.required("Give a score or mark not observed"),
            }),
          evidence: yup
            .string()
            .nullable()
            .when("notObserved", {
              is: false,
              then: (schema) =>
                schema.required("Evidence is required for the score given"),
            }),
        }),
      )
      .test(
        "every-competency-answered",
        "Every competency must be answered or marked not observed",
        (rows = []) =>
          competencies.every((c) => rows.some((row) => row.competencyKey === c.key)),
      ),
  });
