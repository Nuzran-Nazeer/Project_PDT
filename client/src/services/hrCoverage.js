import { apiFetch, buildQuery } from "./api";

export const listCoverage = (filters = {}) =>
  apiFetch(`/hr-coverage${buildQuery(filters)}`);

// `{ all, unitIds }`: every unit for the Head of HR, otherwise the units the caller covers
// today. Decides what to offer, never what is allowed.
export const getMyCoverage = () => apiFetch("/hr-coverage/mine");

// The resolved answer for a unit on a date. Each role is direct or inherited on its own,
// from the nearest unit holding that role; `resolved[role]` says which. Worked out only
// in coverageOn() on the server.
export const getEffectiveCoverage = (unitId, on) =>
  apiFetch(`/hr-coverage/effective/${unitId}${buildQuery(on ? { on } : {})}`);

// If the unit already has an open record for this role, the server closes it on the
// same date rather than overwriting it, so a past decision about who was responsible
// for this unit keeps pointing at whoever actually was.
export const assignCoverage = (data) =>
  apiFetch("/hr-coverage", { method: "POST", body: JSON.stringify(data) });

export const closeCoverage = (id, to) =>
  apiFetch(`/hr-coverage/${id}/close`, { method: "PUT", body: JSON.stringify({ to }) });
