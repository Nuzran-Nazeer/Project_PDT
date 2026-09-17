import { apiFetch } from "./api";

// A whole cycle publishes by advancing it; this is for one review left out of that move.
export const publishReview = (id) =>
  apiFetch(`/reviews/${id}/publish`, { method: "PUT" });
