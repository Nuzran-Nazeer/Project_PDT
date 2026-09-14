import { apiFetch, buildQuery } from "./api";

// ⚠️ Nothing here can name who was picked. After the draw the server serves a count only,
// to HR as well as the supervisor.

export const getTeamLists = () => apiFetch("/reviewer-lists/team");

export const getCycleLists = (cycleId) =>
  apiFetch(`/reviewer-lists${buildQuery({ cycleId })}`);

export const getReviewerList = (reviewId) => apiFetch(`/reviewer-lists/${reviewId}`);

// Name and designation only: supervisors cannot read the employee list.
export const searchAddable = (reviewId, q) =>
  apiFetch(`/reviewer-lists/${reviewId}/addable${buildQuery({ q })}`);

export const confirmReviewerList = (reviewId, changes) =>
  apiFetch(`/reviewer-lists/${reviewId}/confirm`, {
    method: "PUT",
    body: JSON.stringify({ changes }),
  });

export const decideListChange = (reviewId, changeId, approve) =>
  apiFetch(`/reviewer-lists/${reviewId}/changes/${changeId}`, {
    method: "PUT",
    body: JSON.stringify({ approve }),
  });

export const drawReviewers = (reviewId, acknowledged) =>
  apiFetch(`/reviewer-lists/${reviewId}/draw`, {
    method: "PUT",
    body: JSON.stringify({ acknowledged }),
  });
