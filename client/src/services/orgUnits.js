import { apiFetch } from "./api";

// Flat, with each unit's parent on the record: the tree is assembled on the client.
export const listUnits = () => apiFetch("/org-units");

export const getUnit = (id) => apiFetch(`/org-units/${id}`);

export const createUnit = (data) =>
  apiFetch("/org-units", { method: "POST", body: JSON.stringify(data) });

export const updateUnit = (id, data) =>
  apiFetch(`/org-units/${id}`, { method: "PUT", body: JSON.stringify(data) });

// `lastDay` has no default. There is no delete: a discontinued unit stays in the tree.
export const discontinueUnit = (id, lastDay) =>
  apiFetch(`/org-units/${id}/discontinue`, {
    method: "PUT",
    body: JSON.stringify({ lastDay }),
  });
