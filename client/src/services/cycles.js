import { apiFetch } from "./api";

// The appraisal cycle. HR runs it, Head of HR is the backstop, Leadership reads.
//
// There is no delete and there never will be: a published cycle is somebody's
// appraisal record and the evidence that the process was followed. Cancelling is a
// status, never a removal (spec §5.4, LOCKED).

export const listCycles = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value),
  ).toString();
  return apiFetch(`/cycles${query ? `?${query}` : ""}`);
};

export const getCycle = (id) => apiFetch(`/cycles/${id}`);

// Always created as a draft. Opening it is a separate step, because opening is what
// starts the 30-day cancellation clock and records who did it.
export const createCycle = (data) =>
  apiFetch("/cycles", { method: "POST", body: JSON.stringify(data) });

// The stage is NAMED rather than implied. "Advance" with no target reads fine until
// somebody double-clicks and skips a stage without noticing; naming the one they
// expect means a repeated request is refused instead of obeyed.
export const advanceCycle = (id, status) =>
  apiFetch(`/cycles/${id}/advance`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

// A written reason is required and the server refuses without one. It also refuses
// after 30 days from opening, and once the cycle has moved past `open`.
export const cancelCycle = (id, reason) =>
  apiFetch(`/cycles/${id}/cancel`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });

// The cycle the SIGNED-IN person's own group is in, or null. Takes no arguments on
// purpose: the group comes off their own record on the server, so there is no version
// of this that asks about anybody else's.
export const getMyCurrentCycle = () => apiFetch("/cycles/current");
