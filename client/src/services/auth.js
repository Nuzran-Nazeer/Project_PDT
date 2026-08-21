import { apiFetch } from "./api";

// Sign in with either the email address or the generated username.
//
// The server accepts `identifier` and works out which it was given, so the form
// needs ONE field rather than a pair the user has to choose between.
export const login = (identifier, password) =>
  apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

// The controlled lists — designations, locations, roles, and the order that
// decides which dashboard a multi-role user lands on. Requires a token.
export const fetchConstants = () => apiFetch("/constants");
