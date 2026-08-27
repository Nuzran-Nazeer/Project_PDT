import { apiFetch } from "./api";

// The one public write in the client: the caller has no account to sign in with yet.
// No token comes back on purpose, so the caller sends the user to /login afterwards.
// (Build decision B11)
export const activateAccount = (code, password) =>
  apiFetch("/auth/activate", {
    method: "POST",
    body: JSON.stringify({ code, password }),
  });

// The response is the only place the raw code ever exists. Everything after this call
// reads a hash, so a code not copied off this screen is gone.
export const createInvite = (id) => apiFetch(`/users/${id}/invite`, { method: "POST" });
