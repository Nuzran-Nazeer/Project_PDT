import { apiFetch } from "./api";

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

// A soft delete. Closes the person's dated records on `lastWorkingDay` (default today)
// and returns `warnings`, which never block it.
export const deactivateUser = (id, lastWorkingDay) =>
  apiFetch(`/users/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ lastWorkingDay }),
  });
