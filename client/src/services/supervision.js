import { apiFetch, buildQuery } from "./api";

// Read-only: supervision is derived, never stored. `on` means today when omitted.

// `supervisor` is null for someone in no unit, or with no lead anywhere above them.
export const getReportingLine = (userId, on) =>
  apiFetch(`/supervision/${userId}${buildQuery({ on })}`);

// `viaVacancy` is true when the person's own unit has no lead and resolved upward.
export const getTeam = (userId, on) =>
  apiFetch(`/supervision/team/${userId}${buildQuery({ on })}`);
