import { apiFetch } from "./api";

// No delete route: a published cycle is somebody's appraisal record.

export const listCycles = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value),
  ).toString();
  return apiFetch(`/cycles${query ? `?${query}` : ""}`);
};

export const getCycle = (id) => apiFetch(`/cycles/${id}`);

export const getCyclePeople = (id) => apiFetch(`/cycles/${id}/people`);

// Always created as a draft; opening is a separate step.
export const createCycle = (data) =>
  apiFetch("/cycles", { method: "POST", body: JSON.stringify(data) });

// The target stage is named, so a double-click is refused rather than obeyed. Closing over
// reviews that were never published is refused until it is acknowledged.
export const advanceCycle = (id, status, acknowledged = false) =>
  apiFetch(`/cycles/${id}/advance`, {
    method: "PUT",
    body: JSON.stringify({ status, acknowledged }),
  });

export const cancelCycle = (id, reason) =>
  apiFetch(`/cycles/${id}/cancel`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });

// Null when the caller's group is in no cycle.
export const getMyCurrentCycle = () => apiFetch("/cycles/current");
