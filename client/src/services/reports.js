import { apiFetch, buildQuery } from "./api";

// Leadership only, and aggregates only: none of these answers carries a name or a record.
export const getRatingDistribution = (cycle) =>
  apiFetch(`/reports/rating-distribution${buildQuery({ cycle })}`);

export const getPlanProgress = (cycle) =>
  apiFetch(`/reports/plan-progress${buildQuery({ cycle })}`);

export const getAuditCounts = () => apiFetch("/reports/audit-counts");
