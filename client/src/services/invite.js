import { apiFetch } from "./api";

// Public: the caller has no account yet. No token comes back; send them to /login (B11).
export const activateAccount = (code, password) =>
  apiFetch("/auth/activate", {
    method: "POST",
    body: JSON.stringify({ code, password }),
  });

// ⚠️ The response is the only place the raw code ever exists.
export const createInvite = (id) => apiFetch(`/users/${id}/invite`, { method: "POST" });
