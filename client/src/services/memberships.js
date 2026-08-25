import { apiFetch, buildQuery } from "./api";

// Who belongs to which unit, and when. HR and Head of HR write; Leadership reads.
//
// There is no delete, and there never will be: these records are what "who
// supervised whom last March" is answered from, so a delete route would hand
// someone a way to erase the evidence an appraisal was built on.
//
// CLOSING A MEMBERSHIP IS NOT HERE. The endpoint exists, but ending a tenure
// without opening another belongs to *Close a unit and record a leaver*, and
// pulling it in early would put two stories in one commit.

// Takes any of userId, unitId and `on`. `on` is the date the answer is about: with
// it, a person's list is the one unit they were in that day, and a unit's list is
// who was in it that day. Without it, the whole history comes back, newest first.
export const listMemberships = (filters = {}) =>
  apiFetch(`/unit-memberships${buildQuery(filters)}`);

// Opening a FIRST membership for someone who is in no unit at all. A move uses
// transfer instead — this one refuses to open a second while one is still running.
export const openMembership = (data) =>
  apiFetch("/unit-memberships", { method: "POST", body: JSON.stringify(data) });

// Moving someone. One call on purpose: it closes the open membership and opens the
// new one on the same date, and two separate calls could half-succeed and leave a
// person in no unit or in two.
export const transferMembership = (data) =>
  apiFetch("/unit-memberships/transfer", {
    method: "POST",
    body: JSON.stringify(data),
  });
