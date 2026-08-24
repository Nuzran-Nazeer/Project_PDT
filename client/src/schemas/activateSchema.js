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

// What a code looks like, checked in the browser because a MANGLED LINK is the one
// failure the client can catch on its own. Mail clients wrap long URLs, and once a
// truncated code reaches the server it is indistinguishable from a wrong one.
//
// TWO checks, at different strictnesses, and the difference is deliberate.
//
// CODE_SHAPE_EXACT is used on the LINK, before anything is typed. It has to be exact:
// a wrapped URL usually keeps 40-odd characters of the code, so anything looser waves
// through the very case this exists to catch. 64 is the server's INVITE_CODE_BYTES
// doubled, hex being two characters a byte — a coupling worth knowing about, since
// changing that constant changes this.
//
// CODE_SHAPE_LOOSE is used on SUBMIT. If the two ever drift apart, a strict check here
// would lock everyone out of activation: the client would refuse valid codes and tell
// people their link was incomplete while HR reissued more that failed the same way.
// Loose fails OPEN instead — a code this lets through is refused by the server a moment
// later, which is exactly what happened before any of this existed.
//
// Neither leaks anything. The shape of a code is visible in every invite email. Only
// whether a PARTICULAR code is still live is secret, and that stays with the server.
export const CODE_SHAPE_EXACT = /^[0-9a-f]{64}$/i;
const CODE_SHAPE_LOOSE = /^[0-9a-f]{32,}$/i;

// A confirmation field is not in the acceptance criteria. It is here because
// nothing in the system can currently rescue a typo: there is no forgotten-password
// flow yet, so a mistyped password means the invite has to be reissued by HR. One
// extra field is cheaper than that conversation.
export const activateSchema = yup.object({
  code: yup
    .string()
    .trim()
    .required("Paste the code from your invite email")
    .matches(
      CODE_SHAPE_LOOSE,
      "That does not look like a complete code — check you copied all of it",
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
