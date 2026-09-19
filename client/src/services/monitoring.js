import { apiFetch, buildQuery } from "./api";

// Open flags unless a status is asked for: a list that opens on everything ever raised is
// the audit trail again.
export const listFlags = (filters = {}) => apiFetch(`/monitoring${buildQuery(filters)}`);

export const markFlagReviewed = (id, note) =>
  apiFetch(`/monitoring/${id}/reviewed`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
