import { apiFetch } from "./api";

// A list comes back wrapped as { items, total } while a single record comes back
// plain, so pagination has somewhere to live later. (Build decision B3)
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

// A soft delete to status `inactive`. It also closes the dated records that depend on
// the person (their unit membership, any unit they lead) on `lastWorkingDay`, which
// defaults to today: a fortnight of phantom service can flip whether they were
// eligible to review a colleague. The response carries `warnings`, one per unit left
// with no lead, and a warning never blocks it.
export const deactivateUser = (id, lastWorkingDay) =>
  apiFetch(`/users/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ lastWorkingDay }),
  });
