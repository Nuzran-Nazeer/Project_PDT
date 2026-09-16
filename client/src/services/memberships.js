import { apiFetch, buildQuery } from "./api";

// No delete route: a membership is evidence an appraisal was built on.

// With `on`, the one unit they were in that day; without it, the whole history.
export const listMemberships = (filters = {}) =>
  apiFetch(`/unit-memberships${buildQuery(filters)}`);

// Refuses while one is open: a move uses transfer instead.
export const openMembership = (data) =>
  apiFetch("/unit-memberships", { method: "POST", body: JSON.stringify(data) });

// One call: two could half-succeed and leave a person in no unit.
export const transferMembership = (data) =>
  apiFetch("/unit-memberships/transfer", {
    method: "POST",
    body: JSON.stringify(data),
  });
