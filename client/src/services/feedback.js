import { apiFetch } from "./api";

// No delete route: submitted feedback is part of somebody's appraisal record.

export const listOwed = () => apiFetch("/feedback/owed");

export const getOwed = (id) => apiFetch(`/feedback/owed/${id}`);

export const saveDraft = (id, answers) =>
  apiFetch(`/feedback/owed/${id}`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });

// ⚠️ `editable` on the returned record is the five-hour window; nothing computes it client-side.
export const submitFeedback = (id, answers) =>
  apiFetch(`/feedback/owed/${id}/submit`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });

// ⚠️ `released: false` is a real state, not an empty list.
export const getCollected = (reviewId) => apiFetch(`/feedback/collected/${reviewId}`);

// ⚠️ Named by the response's label, never a record id: a confidential record never serves one.
// HR only, and the server refuses an officer inside the employee's reporting line. The reason
// is required before any name comes back.
export const revealAuthor = (reviewId, label, reason) =>
  apiFetch(`/feedback/collected/${reviewId}/${label}/reveal`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

// Keyed on the review: until the first save there is no record to name. 409 until ready.
export const getSupervisorReview = (reviewId) =>
  apiFetch(`/feedback/supervisor/${reviewId}`);

export const saveSupervisorDraft = (reviewId, answers) =>
  apiFetch(`/feedback/supervisor/${reviewId}`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });

export const submitSupervisorReview = (reviewId, answers) =>
  apiFetch(`/feedback/supervisor/${reviewId}/submit`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });

// `available: false` carries a `reason`: `not_submitted` or `in_window`.
export const getTeamMemberAssessment = (reviewId) =>
  apiFetch(`/feedback/self-assessment/${reviewId}`);

// ⚠️ No id, deliberately: the server reads everything off the signed-in person.
export const getSelfAssessment = () => apiFetch("/feedback/self");

export const saveSelfDraft = (answers) =>
  apiFetch("/feedback/self", {
    method: "PUT",
    body: JSON.stringify(answers),
  });

export const submitSelfAssessment = (answers) =>
  apiFetch("/feedback/self/submit", {
    method: "PUT",
    body: JSON.stringify(answers),
  });
