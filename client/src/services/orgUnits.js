import { apiFetch } from "./api";

// The unit tree. Read by HR, Head of HR and Leadership; written only by the Head of
// HR, which is what the server enforces — the buttons on the page only decide what
// is worth showing.
//
// There is no delete and there never will be: a unit is somebody's appraisal
// history. Closing one is a separate operation with three checks in front of it,
// and it arrives with its own story.

// Comes back as { items, total }, like every other collection here (build decision
// B3). Flat, with each unit's parent on the record — the tree shape is assembled on
// the client, because a collection is honestly a list and what it looks like is a
// display decision.
export const listUnits = () => apiFetch("/org-units");

export const getUnit = (id) => apiFetch(`/org-units/${id}`);

export const createUnit = (data) =>
  apiFetch("/org-units", { method: "POST", body: JSON.stringify(data) });

export const updateUnit = (id, data) =>
  apiFetch(`/org-units/${id}`, { method: "PUT", body: JSON.stringify(data) });
