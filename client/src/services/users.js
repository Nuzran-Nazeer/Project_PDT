import { apiFetch } from "./api";

// Employee records. Every call here is behind a token and a role check on the
// server — HR to write, HR/Head of HR/Leadership to read — so a screen that
// forgets to hide a button still cannot do the thing the button offers.

// The list comes back wrapped as { items, total } while a single record comes back
// plain. Collections are wrapped so pagination has somewhere to live later without
// breaking every caller that wrote `users.map(...)`. (Build decision B3)
export const listUsers = (filters = {}) => {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString();

  return apiFetch(`/users${query ? `?${query}` : ""}`);
};

export const getUser = (id) => apiFetch(`/users/${id}`);

export const createUser = (data) =>
  apiFetch("/users", { method: "POST", body: JSON.stringify(data) });

export const updateUser = (id, data) =>
  apiFetch(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) });

// A soft delete: the record survives with status `inactive` and drops out of
// listings. It is somebody's appraisal history and is never removed.
export const deactivateUser = (id) => apiFetch(`/users/${id}`, { method: "DELETE" });
