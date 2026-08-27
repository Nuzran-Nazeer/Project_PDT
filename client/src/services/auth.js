import { apiFetch } from "./api";

// The server accepts `identifier` and works out whether it is the email or the
// generated username, so the form needs one field rather than a pair.
export const login = (identifier, password) =>
  apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

export const fetchConstants = () => apiFetch("/constants");

// Carries no id: the server takes it from the token.
export const fetchMe = () => apiFetch("/auth/me");
