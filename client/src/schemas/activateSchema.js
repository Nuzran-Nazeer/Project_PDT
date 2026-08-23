import * as yup from "yup";

// The server's own minimum, copied rather than fetched.
//
// Every other controlled value in this client comes from GET /api/constants, which
// is how the two halves cannot drift. This one cannot: the endpoint needs a token
// and this page runs BEFORE the person has an account to sign in with. It is the
// only value in the client duplicated from the server.
//
// The duplication fails safe. If the two ever disagree, the server still rejects
// the password and the user sees the server's message, so the worst case is a
// confusing error rather than a password the server will not accept later.
const MIN_PASSWORD_LENGTH = 8;

// A confirmation field is not in the acceptance criteria. It is here because
// nothing in the system can currently rescue a typo: there is no forgotten-password
// flow yet, so a mistyped password means the invite has to be reissued by HR. One
// extra field is cheaper than that conversation.
export const activateSchema = yup.object({
  code: yup.string().trim().required("Paste the code from your invite email"),
  password: yup
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
    .required("Choose a password"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password")], "Both entries must match")
    .required("Type the password again"),
});
