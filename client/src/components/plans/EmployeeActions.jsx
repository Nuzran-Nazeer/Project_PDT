import { useState } from "react";
import { formatDate } from "../../utils/dates";
import { categoryLabel, actionStatusLabel, daysSinceLabel } from "../../utils/planLabels";

// The employee's own view of their actions, on either kind of plan. ⚠️ The competency behind
// an action never appears here and is not in the response that feeds it.

const primaryClass =
  "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass =
  "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";

export default function EmployeeActions({
  actions,
  canAddNote,
  busy,
  error,
  onAddNote,
  onStartNote,
}) {
  const [notingId, setNotingId] = useState(null);
  const [noteText, setNoteText] = useState("");

  const stop = () => {
    setNotingId(null);
    setNoteText("");
  };

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="grid gap-3">
        {actions.map((action) => (
          <li key={action.id} className="rounded-lg border border-line p-4 text-sm">
            <p className="font-medium text-ink">{action.description}</p>

            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] text-muted sm:grid-cols-2">
              <Row label="Category">{categoryLabel(action.category)}</Row>
              <Row label="Owner">{action.owner?.name || "Not recorded"}</Row>
              <Row label="Target date">{formatDate(action.targetDate)}</Row>
              <Row label="State">
                {actionStatusLabel(action.status)}
                {daysSinceLabel(action.daysSinceChange) &&
                  ` · ${daysSinceLabel(action.daysSinceChange)}`}
              </Row>
            </dl>

            <p className="mt-3 text-[13px] text-muted">
              <span className="font-medium text-ink">Success criterion: </span>
              {action.successCriteria}
            </p>

            {action.progressNotes.length > 0 && (
              <ul className="mt-3 grid gap-2 border-t border-line pt-3">
                {action.progressNotes.map((note, i) => (
                  <li key={i} className="text-[13px] text-muted">
                    <span className="whitespace-pre-line">{note.note}</span>
                    <span className="mt-0.5 block text-[12px]">
                      {note.by?.name || "Unknown"} · {formatDate(note.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {canAddNote &&
              (notingId === action.id ? (
                <div className="mt-3">
                  <label htmlFor={`note-${action.id}`} className="sr-only">
                    Progress note
                  </label>
                  <textarea
                    id={`note-${action.id}`}
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  />
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className={primaryClass}
                      disabled={busy || !noteText.trim()}
                      onClick={() => onAddNote(action.id, noteText.trim(), stop)}
                    >
                      {busy ? "Saving…" : "Add note"}
                    </button>
                    <button
                      type="button"
                      className={secondaryClass}
                      disabled={busy}
                      onClick={stop}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNotingId(action.id);
                    setNoteText("");
                    onStartNote?.();
                  }}
                  className="mt-3 cursor-pointer text-[13px] text-brand transition-colors hover:underline"
                >
                  Add a progress note
                </button>
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <dt className="inline font-medium text-ink">{label}: </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}
