import { apiFetch, buildQuery } from "./api";

export const listAssignments = (filters = {}) =>
  apiFetch(`/project-assignments${buildQuery(filters)}`);

export const getAssignment = (id) => apiFetch(`/project-assignments/${id}`);

// ⚠️ `to` is the API's exclusive end: callers convert a last working day with dayAfter().
export const createAssignment = (data) =>
  apiFetch("/project-assignments", { method: "POST", body: JSON.stringify(data) });

// ⚠️ `to` is exclusive here too, already converted by the caller.
export const closeAssignment = (id, to) =>
  apiFetch(`/project-assignments/${id}/close`, {
    method: "PUT",
    body: JSON.stringify({ to }),
  });

// `from` is a start, so it needs no conversion.
export const markTeamLead = (id, from) =>
  apiFetch(`/project-assignments/${id}/team-lead`, {
    method: "PUT",
    body: JSON.stringify({ from }),
  });
