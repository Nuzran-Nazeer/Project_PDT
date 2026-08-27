import { apiFetch } from "./api";

// Comes back as { items, total }, like every other collection here (build decision
// B3). Flat, with each unit's parent on the record: the tree shape is assembled on
// the client.
export const listUnits = () => apiFetch("/org-units");

export const getUnit = (id) => apiFetch(`/org-units/${id}`);

export const createUnit = (data) =>
  apiFetch("/org-units", { method: "POST", body: JSON.stringify(data) });

export const updateUnit = (id, data) =>
  apiFetch(`/org-units/${id}`, { method: "PUT", body: JSON.stringify(data) });

// `lastDay` is required and has no default. A unit closing is a dated event somebody
// decided on, so stamping today onto it would invent the fact. There is no delete: a
// discontinued unit stays in the tree, marked.
export const discontinueUnit = (id, lastDay) =>
  apiFetch(`/org-units/${id}/discontinue`, {
    method: "PUT",
    body: JSON.stringify({ lastDay }),
  });
