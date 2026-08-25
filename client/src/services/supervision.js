import { apiFetch, buildQuery } from "./api";

// Who supervises whom. Read-only: there is nothing to write, because supervision is
// DERIVED from the unit tree and the dated leadership records rather than stored.
//
// The answer comes back as { employee, on, unit, supervisor, resolvedUpward,
// skipLevel }. `supervisor` is null for somebody in no unit, and for somebody whose
// unit and every unit above it had no lead on the date — both are real answers, not
// failures, and a caller that treats null as an error will be wrong about a new
// starter on their first day.
//
// `on` is optional and means today.

// ⚠️ TODAY THIS RETURNS 403 TO AN EMPLOYEE ASKING ABOUT THEMSELVES. The endpoint is
// granted to hr, head_of_hr and leadership only; the criterion that an employee may
// see their own supervisor was added after the server half merged, and the grant has
// not been widened yet. That change belongs on the server branch. Known, intended,
// and the screen below is written against the endpoint as it will be.
export const getReportingLine = (userId, on) =>
  apiFetch(`/supervision/${userId}${buildQuery({ on })}`);
