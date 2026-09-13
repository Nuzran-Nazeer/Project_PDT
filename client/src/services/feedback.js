import { apiFetch } from "./api";

// No delete route: a submitted piece of feedback is part of somebody's appraisal record.

// Everything the signed-in person has been asked to write. The server filters by the id
// in the token, so there is no request shape that returns somebody else's.
export const listOwed = () => apiFetch("/feedback/owed");

export const getOwed = (id) => apiFetch(`/feedback/owed/${id}`);

export const saveDraft = (id, answers) =>
  apiFetch(`/feedback/owed/${id}`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });

// ⚠️ `editable` on the returned record is what the five-hour window actually is; nothing
// computes it client-side.
export const submitFeedback = (id, answers) =>
  apiFetch(`/feedback/owed/${id}/submit`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });

// ⚠️ `released: false` is a real state, not an empty list: nothing is shown until half the
// pool or three, whichever is larger, have submitted AND their windows have closed.
export const getCollected = (reviewId) => apiFetch(`/feedback/collected/${reviewId}`);

// Keyed on the REVIEW rather than a record id: until the first save there is no record to
// name. All three are refused with a 409 until the review is ready.
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

// ⚠️ `available: false` carries a `reason`, and the two are different facts: never
// submitted, or submitted and still inside the window its author may change it in.
export const getTeamMemberAssessment = (reviewId) =>
  apiFetch(`/feedback/self-assessment/${reviewId}`);

// ⚠️ No id, deliberately. The server reads the cycle and the review off the signed-in
// person, so there is no call shape here that could ask about somebody else.
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
