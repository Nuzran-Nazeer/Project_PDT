import { apiFetch } from "./api";

// Redeem an invite code and set a password. The ONE public write in the client:
// the person calling it has no account to sign in with yet, which is exactly why
// the code exists and why it is single-use and expiring.
//
// Nothing else may be sent. The server reads `code` and `password` and ignores the
// rest of the body, and passing more from here would only look like it worked.
//
// No token comes back on purpose. Signing in stays the only thing that starts a
// session, so the caller sends the user to /login afterwards. (Build decision B11)
export const activateAccount = (code, password) =>
  apiFetch("/auth/activate", {
    method: "POST",
    body: JSON.stringify({ code, password }),
  });
