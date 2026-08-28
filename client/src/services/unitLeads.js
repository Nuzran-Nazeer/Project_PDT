import { apiFetch, buildQuery } from "./api";

export const listLeads = (filters = {}) => apiFetch(`/unit-leads${buildQuery(filters)}`);

// If the unit already has a lead, the server closes that record on the same date
// rather than overwriting it, so past appraisals keep pointing at whoever ran the
// unit at the time.
export const appointLead = (data) =>
  apiFetch("/unit-leads", { method: "POST", body: JSON.stringify(data) });
