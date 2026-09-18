import { apiFetch } from "./api";

// ⚠️ Neither call takes an id: the result is reached through the signed-in account alone.
export const getMyResult = () => apiFetch("/reviews/my-result");

export const acknowledgeMyResult = () =>
  apiFetch("/reviews/my-result/acknowledge", { method: "PUT" });

// A whole cycle publishes by advancing it; this is for one review left out of that move.
export const publishReview = (id) =>
  apiFetch(`/reviews/${id}/publish`, { method: "PUT" });

// Every colleague summary owed a check within the caller's coverage.
export const listSummaryChecks = () => apiFetch("/reviews/summary-checks");

// The summary beside the raw responses, the supervisor's record read-only, and the history.
export const getSummaryCheck = (reviewId) =>
  apiFetch(`/reviews/${reviewId}/summary-check`);

export const clearSummary = (reviewId) =>
  apiFetch(`/reviews/${reviewId}/summary-check/clear`, { method: "PUT" });

// Returns the supervisor's review to draft; the reason is theirs to read.
export const sendBackSummary = (reviewId, reason) =>
  apiFetch(`/reviews/${reviewId}/summary-check/send-back`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });
