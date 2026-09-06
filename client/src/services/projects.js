import { apiFetch, buildQuery } from "./api";

// Projects. Assignments are a separate collection with its own service, the same split
// the org tree makes between units and the memberships inside them.

export const listProjects = (filters = {}) => apiFetch(`/projects${buildQuery(filters)}`);

export const getProject = (id) => apiFetch(`/projects/${id}`);

export const createProject = (data) =>
  apiFetch("/projects", { method: "POST", body: JSON.stringify(data) });

// ⚠️ `lastDay` goes STRAIGHT THROUGH, unconverted. This is the one end date the server
// takes inclusively -- it does the day arithmetic itself, exactly as discontinuing a
// unit does. Adding a day here would close the project a day late.
export const closeProject = (id, lastDay) =>
  apiFetch(`/projects/${id}/close`, {
    method: "PUT",
    body: JSON.stringify({ lastDay }),
  });

// Two modes, and the server refuses them mixed: `{ on }` for a single day, or
// `{ from, to }` for a period. They come back in DIFFERENT SHAPES -- a single
// `teamLead` against `on`, a `teamLeadHistory` against a period -- so the caller has to
// know which it asked for.
//
// ⚠️ `to` here is the API's exclusive end. A caller passing a last working day must
// convert it with dayAfter() first.
export const getProjectTeam = (id, params = {}) =>
  apiFetch(`/projects/${id}/team${buildQuery(params)}`);
