import { apiFetch } from "./api";

// ⚠️ No call here takes a supervisor id: who may write a plan is derived from who leads the
// employee's unit today, and the server decides it from the signed-in account alone.

// Everyone supervised today whose review is published, marked owed, draft or shared.
export const getTeamPlans = () => apiFetch("/plans/team");

// Starting a plan twice on one review opens the plan already there.
export const startPlan = (reviewId) =>
  apiFetch("/plans", { method: "POST", body: JSON.stringify({ reviewId }) });

export const getPlan = (id) => apiFetch(`/plans/${id}`);

export const addAction = (id, action) =>
  apiFetch(`/plans/${id}/actions`, { method: "POST", body: JSON.stringify(action) });

export const editAction = (id, actionId, action) =>
  apiFetch(`/plans/${id}/actions/${actionId}`, {
    method: "PUT",
    body: JSON.stringify(action),
  });

export const removeAction = (id, actionId) =>
  apiFetch(`/plans/${id}/actions/${actionId}`, { method: "DELETE" });

// Hands the plan to the employee; their acknowledgement is what makes it active.
export const sharePlan = (id) => apiFetch(`/plans/${id}/share`, { method: "PUT" });

// Two entry points, one call. The server records which one and the plan behaves the same
// either way, so nothing downstream branches on it.
export const startImprovementPlan = (body) =>
  apiFetch("/plans/improvement", { method: "POST", body: JSON.stringify(body) });

// Sends an improvement plan to HR. It cannot be shared until an officer approves it.
export const submitForApproval = (id) =>
  apiFetch(`/plans/${id}/submit`, { method: "PUT" });

// A refusal needs a written reason and returns the plan to the supervisor as a draft.
export const decidePlan = (id, decision, reason) =>
  apiFetch(`/plans/${id}/decision`, {
    method: "PUT",
    body: JSON.stringify({ decision, reason }),
  });

// What is waiting on the officer reading it, across the units they cover today.
export const getImprovementQueue = () => apiFetch("/plans/improvement/queue");

// HR's read within their coverage, addressed by the employee: the officer reaches it from
// that person's record and has no plan id before opening it.
export const getPlanForCoverage = (userId) => apiFetch(`/plans/employee/${userId}`);

// The employee's own plan, reached without an id: the server decides whose it is.
export const getMyPlan = () => apiFetch("/plans/mine");

export const acknowledgeMyPlan = () =>
  apiFetch("/plans/mine/acknowledge", { method: "PUT" });

export const addProgressNote = (actionId, note) =>
  apiFetch(`/plans/mine/actions/${actionId}/notes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });

// Appended only: there is no call to edit or delete one, because a check-in records a
// conversation that happened. A correction is a further check-in.
export const recordCheckIn = (id, checkIn) =>
  apiFetch(`/plans/${id}/check-ins`, { method: "POST", body: JSON.stringify(checkIn) });

// The supervisor's alone, including on an action the employee owns.
export const setActionStatus = (id, actionId, status) =>
  apiFetch(`/plans/${id}/actions/${actionId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
