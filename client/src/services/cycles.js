import { apiFetch } from "./api";

// No delete route: a published cycle is somebody's appraisal record. Cancelling is a
// status, never a removal (spec §5.4).

export const listCycles = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value),
  ).toString();
  return apiFetch(`/cycles${query ? `?${query}` : ""}`);
};

export const getCycle = (id) => apiFetch(`/cycles/${id}`);

// Derived on the server from the group on each person's record, never stored, so it
// cannot drift. Carries no review status, because reviews do not exist yet.
export const getCyclePeople = (id) => apiFetch(`/cycles/${id}/people`);

// Always created as a draft. Opening it is a separate step, because opening starts
// the 30-day cancellation clock and records who did it.
export const createCycle = (data) =>
  apiFetch("/cycles", { method: "POST", body: JSON.stringify(data) });

// The target stage is named rather than implied, so a double-click is refused rather
// than obeyed and silently skipping a stage.
export const advanceCycle = (id, status) =>
  apiFetch(`/cycles/${id}/advance`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

// The server refuses without a reason, after 30 days from opening, and once the cycle
// has moved past `open`.
export const cancelCycle = (id, reason) =>
  apiFetch(`/cycles/${id}/cancel`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });

// Takes no arguments: the group comes off the signed-in person's own record on the
// server. Returns null when their group is in no cycle.
export const getMyCurrentCycle = () => apiFetch("/cycles/current");
