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

// An employee may ask about THEMSELVES and nobody else; hr, head_of_hr and leadership
// may ask about anyone. The server decides that by comparing the id in the URL against
// the id in the token, so it cannot be widened from here.
//
// This comment previously warned that an employee got a 403 asking about themselves.
// That was true when the screen was written and stopped being true when the grant
// landed on the server branch.
export const getReportingLine = (userId, on) =>
  apiFetch(`/supervision/${userId}${buildQuery({ on })}`);

// The people somebody supervises on a date. Story 17, criterion 1.
//
// Same grant as the reporting line above: your own team always, anybody's if you
// hold a reader role. It answers the PEOPLE, not their submissions -- there is no
// review collection for a submission status to come from.
//
// Each person carries `viaVacancy`, true when they are here because their own unit
// has no lead and the answer resolved upward to this supervisor.
export const getTeam = (userId, on) =>
  apiFetch(`/supervision/team/${userId}${buildQuery({ on })}`);
