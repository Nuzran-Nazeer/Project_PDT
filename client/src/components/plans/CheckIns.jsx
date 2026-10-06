import { formatDate, formatDateTime } from "../../utils/dates";
import {
  checkInOutcomeLabel,
  windowStateLabel,
  CHECK_IN_OUTCOME_TONE,
  WINDOW_STATE_TONE,
} from "../../utils/planLabels";

// Shared by the supervisor, the employee and HR. ⚠️ Safe on all three: a check-in carries an
// outcome about the plan, never a rating, a band or the competency an action came from.

export function CheckInEntries({ entries, kind = "check-in" }) {
  const noun = kind === "meeting" ? "Meeting" : "Check-in";

  if (!entries?.length) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
        No {kind === "meeting" ? "meetings" : "check-ins"} held yet.
      </p>
    );
  }

  return (
    <ul className="grid gap-3">
      {entries.map((entry) => (
        <li
          key={`${entry.number}-${entry.at}`}
          className="rounded-lg border border-line p-4 text-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-ink">
              {entry.additional
                ? `Additional ${noun.toLowerCase()}`
                : `${noun} ${entry.number}`}
              <span className="ml-2 font-normal text-muted">{formatDate(entry.at)}</span>
            </p>

            <span
              className={`text-[13px] ${CHECK_IN_OUTCOME_TONE[entry.outcome] || "text-muted"}`}
            >
              {checkInOutcomeLabel(entry.outcome)}
            </span>
          </div>

          <p className="mt-2 whitespace-pre-line text-[13px] text-muted">{entry.note}</p>

          <p className="mt-2 text-[12px] text-muted">
            {entry.by?.name || "Unknown"}
            {/* Shown only where they differ, which is what marks a late write-up. */}
            {entry.recordedAt &&
              formatDate(entry.recordedAt) !== formatDate(entry.at) &&
              ` · recorded ${formatDateTime(entry.recordedAt)}`}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function CheckInSchedule({ summary, kind = "check-in" }) {
  if (!summary) return null;

  const noun = kind === "meeting" ? "Meeting" : "Check-in";
  const plural = kind === "meeting" ? "meetings" : "check-ins";

  // An improvement plan has no dates until it is shared, so nothing is owed yet.
  if (summary.expected === null) {
    return (
      <p className="text-[13px] text-muted">
        <span className="font-medium text-ink">{summary.held} held</span>
      </p>
    );
  }

  return (
    <>
      <p className="text-[13px] text-muted">
        <span className="font-medium text-ink">
          {summary.held} of {summary.expected} held
        </span>
        {summary.remaining > 0 && ` · ${summary.remaining} remaining`}
        {summary.additional > 0 && ` · ${summary.additional} additional`}
      </p>

      {summary.held === 0 && (
        <p className="mt-1 text-[13px] text-muted">No {plural} held yet.</p>
      )}

      {summary.windows?.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {summary.windows.map((window) => (
            <li
              key={window.number}
              className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted"
            >
              <span className="font-medium text-ink">
                {noun} {window.number}
              </span>
              <span>
                {formatDate(window.opensOn)} to{" "}
                {formatDate(window.closesOn || window.dueOn)}
              </span>
              <span className={WINDOW_STATE_TONE[window.state] || "text-muted"}>
                {windowStateLabel(window.state)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
