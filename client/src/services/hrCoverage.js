import { apiFetch, buildQuery } from "./api";

export const listCoverage = (filters = {}) =>
  apiFetch(`/hr-coverage${buildQuery(filters)}`);

// `{ all, unitIds }`. Decides what to offer, never what is allowed.
export const getMyCoverage = () => apiFetch("/hr-coverage/mine");

// Each role is direct or inherited on its own; `resolved[role]` says which.
export const getEffectiveCoverage = (unitId, on) =>
  apiFetch(`/hr-coverage/effective/${unitId}${buildQuery(on ? { on } : {})}`);

// An open record for the same role is closed on the handover date, never overwritten.
export const assignCoverage = (data) =>
  apiFetch("/hr-coverage", { method: "POST", body: JSON.stringify(data) });

export const closeCoverage = (id, to) =>
  apiFetch(`/hr-coverage/${id}/close`, { method: "PUT", body: JSON.stringify({ to }) });
