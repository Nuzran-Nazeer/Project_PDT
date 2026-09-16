import { apiFetch, buildQuery } from "./api";

export const listLeads = (filters = {}) => apiFetch(`/unit-leads${buildQuery(filters)}`);

// An existing lead's record is closed on the same date, never overwritten.
export const appointLead = (data) =>
  apiFetch("/unit-leads", { method: "POST", body: JSON.stringify(data) });
