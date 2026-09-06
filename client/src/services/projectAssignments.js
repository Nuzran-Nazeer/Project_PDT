import { apiFetch, buildQuery } from "./api";

// Who is on a project, and when. One record per stint, never overwritten: a change
// closes one and opens another, so past teams stay readable.

export const listAssignments = (filters = {}) =>
  apiFetch(`/project-assignments${buildQuery(filters)}`);

export const getAssignment = (id) => apiFetch(`/project-assignments/${id}`);

// ⚠️ `to` is the API's EXCLUSIVE end, the first day not covered. Screens ask HR for a
// last working day, so every caller converts with dayAfter() before getting here.
// Omit it entirely for ongoing work.
export const createAssignment = (data) =>
  apiFetch("/project-assignments", { method: "POST", body: JSON.stringify(data) });

// Same convention as above: `to` is exclusive, already converted by the caller.
export const closeAssignment = (id, to) =>
  apiFetch(`/project-assignments/${id}/close`, {
    method: "PUT",
    body: JSON.stringify({ to }),
  });

// `from` is a start, so it is inclusive and needs no conversion. The server owns every
// rule about it: it must fall after this assignment began and after the current team
// lead took over, and it may not land inside somebody else's closed term.
export const markTeamLead = (id, from) =>
  apiFetch(`/project-assignments/${id}/team-lead`, {
    method: "PUT",
    body: JSON.stringify({ from }),
  });
