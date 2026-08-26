import { apiFetch, buildQuery } from "./api";

// Who leads which unit, and when. This collection IS the reporting line — your
// supervisor is the lead of your unit — which is why reading it is kept to HR,
// Head of HR and Leadership rather than being open to everyone.
//
// Closing a term is deliberately absent, for the same reason as memberships: it
// belongs to the closing story.

export const listLeads = (filters = {}) => apiFetch(`/unit-leads${buildQuery(filters)}`);

// Appointing. If the unit already has a lead, the server CLOSES that record on the
// same date rather than overwriting it, so last year's appraisals keep pointing at
// whoever actually ran the unit last year.
export const appointLead = (data) =>
  apiFetch("/unit-leads", { method: "POST", body: JSON.stringify(data) });
