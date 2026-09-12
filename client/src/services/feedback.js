import { apiFetch } from "./api";

// No delete route: a submitted piece of feedback is part of somebody's appraisal
// record.

// Everything the signed-in person has been asked to write. The server filters by the
// id in the token, so there is no request shape that returns somebody else's.
export const listOwed = () => apiFetch("/feedback/owed");

export const getOwed = (id) => apiFetch(`/feedback/owed/${id}`);

export const saveDraft = (id, answers) =>
  apiFetch(`/feedback/owed/${id}`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });

// Starts the five-hour edit window. `editable` on the returned record is what the
// window actually is; nothing computes it client-side.
export const submitFeedback = (id, answers) =>
  apiFetch(`/feedback/owed/${id}/submit`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });

// The supervisor's read of what has arrived for one person. `released: false` is a
// real state, not an empty list: nothing is shown until half the assigned reviewers
// have submitted.
export const getCollected = (reviewId) => apiFetch(`/feedback/collected/${reviewId}`);

// ⚠️ No id, deliberately. The server reads the cycle off the signed-in person's own
// appraisal group and the review off their own id, so there is no call shape here that
// could ask about somebody else.
//
// It answers with the cycle and the competencies even when nothing has been written
// yet, and `status: "not_started"` until the first save creates the record.
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
