import { apiFetch, buildQuery } from "./api";

// No delete route, deliberately: these records answer "who supervised whom last
// March", so deleting one erases the evidence an appraisal was built on.

// `on` is the date the answer is about. With it, a person's list is the one unit they
// were in that day. Without it, the whole history comes back, newest first.
export const listMemberships = (filters = {}) =>
  apiFetch(`/unit-memberships${buildQuery(filters)}`);

// Opens a FIRST membership only, and refuses to open a second while one is running.
// A move uses transfer instead.
export const openMembership = (data) =>
  apiFetch("/unit-memberships", { method: "POST", body: JSON.stringify(data) });

// One call on purpose: it closes the open membership and opens the new one on the
// same date. Two separate calls could half-succeed and leave a person in no unit.
export const transferMembership = (data) =>
  apiFetch("/unit-memberships/transfer", {
    method: "POST",
    body: JSON.stringify(data),
  });
