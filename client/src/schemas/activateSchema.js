import * as yup from "yup";

// Duplicated from the server: GET /api/constants needs a token and this page runs first.
const MIN_PASSWORD_LENGTH = 8;

// 64 is the server's INVITE_CODE_BYTES doubled (hex). EXACT catches a link a mail client
// wrapped; LOOSE is used on submit and fails open, since the server refuses anyway.
export const CODE_SHAPE_EXACT = /^[0-9a-f]{64}$/i;
const CODE_SHAPE_LOOSE = /^[0-9a-f]{32,}$/i;

export const activateSchema = yup.object({
  code: yup
    .string()
    .trim()
    .required("Paste the code from your invite email")
    .matches(
      CODE_SHAPE_LOOSE,
      "That does not look like a complete code. Check you copied all of it",
    ),
  password: yup
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
    .required("Choose a password"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password")], "Both entries must match")
    .required("Type the password again"),
});
