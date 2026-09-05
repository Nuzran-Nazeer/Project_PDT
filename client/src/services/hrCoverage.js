import { apiFetch, buildQuery } from "./api";

export const listCoverage = (filters = {}) =>
  apiFetch(`/hr-coverage${buildQuery(filters)}`);

// The resolved answer for a unit on a date: direct coverage, or inherited from the
// nearest ancestor that has any -- see coverageOn() on the server, the one place this
// is worked out.
export const getEffectiveCoverage = (unitId, on) =>
  apiFetch(`/hr-coverage/effective/${unitId}${buildQuery(on ? { on } : {})}`);

// If the unit already has an open record for this role, the server closes it on the
// same date rather than overwriting it, so a past decision about who was responsible
// for this unit keeps pointing at whoever actually was.
export const assignCoverage = (data) =>
  apiFetch("/hr-coverage", { method: "POST", body: JSON.stringify(data) });

export const closeCoverage = (id, to) =>
  apiFetch(`/hr-coverage/${id}/close`, { method: "PUT", body: JSON.stringify({ to }) });
