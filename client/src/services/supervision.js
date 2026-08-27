import { apiFetch, buildQuery } from "./api";

// Read-only: supervision is derived from the unit tree and the dated leadership
// records, never stored. `on` is optional and means today.

// `supervisor` is null for someone in no unit, and for someone whose unit and every
// unit above it had no lead on the date. Both are real answers, not failures.
export const getReportingLine = (userId, on) =>
  apiFetch(`/supervision/${userId}${buildQuery({ on })}`);

// Each person carries `viaVacancy`, true when they are here only because their own
// unit has no lead and the answer resolved upward to this supervisor.
export const getTeam = (userId, on) =>
  apiFetch(`/supervision/team/${userId}${buildQuery({ on })}`);
