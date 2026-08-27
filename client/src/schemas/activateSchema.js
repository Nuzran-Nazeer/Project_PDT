import * as yup from "yup";

// The only value in this client duplicated from the server rather than fetched from
// GET /api/constants: that endpoint needs a token, and this page runs before the
// person has an account. It fails safe, because the server checks it again.
const MIN_PASSWORD_LENGTH = 8;

// Two checks at different strictnesses, deliberately. EXACT is used on the LINK,
// where a mail client wrapping a long URL leaves 40-odd characters and anything
// looser waves through the case this exists to catch. 64 is the server's
// INVITE_CODE_BYTES doubled, hex being two characters a byte, so changing that
// constant changes this. LOOSE is used on SUBMIT and fails OPEN: if the two ever
// drift, a strict check here would refuse valid codes and lock everyone out of
// activation, whereas a code this lets through is refused by the server a moment
// later.
export const CODE_SHAPE_EXACT = /^[0-9a-f]{64}$/i;
const CODE_SHAPE_LOOSE = /^[0-9a-f]{32,}$/i;

// There is no forgotten-password flow, so a mistyped password means HR reissues the
// invite. Hence the confirmation field.
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
