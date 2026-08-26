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
//
// It also CLOSES the dated records that depend on the person — their unit membership
// and any unit they lead — on `lastWorkingDay`. That date is optional and defaults
// to today on the server, but HR is asked for it, because a leaver is processed
// after they have gone and a fortnight of phantom service can flip whether they were
// eligible to review a colleague.
//
// The response is the record plus `warnings`: one for each unit left with no lead.
// A warning never blocks it. A person leaving is a fact that has already happened
// and cannot be refused by paperwork — which is exactly why a unit closing can be.
export const deactivateUser = (id, lastWorkingDay) =>
  apiFetch(`/users/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ lastWorkingDay }),
  });
