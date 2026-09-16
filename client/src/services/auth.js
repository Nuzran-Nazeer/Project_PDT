import { apiFetch } from "./api";

export const login = (identifier, password) =>
  apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

export const fetchConstants = () => apiFetch("/constants");

export const fetchMe = () => apiFetch("/auth/me");
