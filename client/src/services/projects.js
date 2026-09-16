import { apiFetch, buildQuery } from "./api";

export const listProjects = (filters = {}) => apiFetch(`/projects${buildQuery(filters)}`);

export const getProject = (id) => apiFetch(`/projects/${id}`);

export const createProject = (data) =>
  apiFetch("/projects", { method: "POST", body: JSON.stringify(data) });

// ⚠️ `lastDay` goes through unconverted: the server takes this one inclusively.
export const closeProject = (id, lastDay) =>
  apiFetch(`/projects/${id}/close`, {
    method: "PUT",
    body: JSON.stringify({ lastDay }),
  });

// `{ on }` returns `teamLead`; `{ from, to }` returns `teamLeadHistory`. Never mixed.
// ⚠️ `to` is the API's exclusive end: convert a last working day with dayAfter() first.
export const getProjectTeam = (id, params = {}) =>
  apiFetch(`/projects/${id}/team${buildQuery(params)}`);
