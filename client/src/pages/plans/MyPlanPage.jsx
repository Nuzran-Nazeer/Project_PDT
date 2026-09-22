import { useEffect, useState } from "react";
import { getMyPlan, acknowledgeMyPlan, addProgressNote } from "../../services/plans";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import { FormShell, FormSection } from "../../components/shells/FormShell";
import { CheckInEntries } from "../../components/plans/CheckIns";
import { categoryLabel, actionStatusLabel, daysSinceLabel } from "../../utils/planLabels";

// ⚠️ The competency behind an action never appears here and is not in the response. The
// supervisor's page is the only view that carries it.

const primaryClass =
  "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass =
  "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";

const NOTHING_TO_READ = {
  no_review: "No result has been published for you yet.",
  no_plan: "No plan has been written against your published result yet.",
};

function Row({ label, children }) {
  return (
    <div>
      <dt className="inline font-medium text-ink">{label}: </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}

function Shell({ children }) {
  return (
    <>
      <PageHeader title="My development plan" backTo="/dashboard" />
      {children}
    </>
  );
}

export default function MyPlanPage() {
  const [plan, setPlan] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [confirming, setConfirming] = useState(false);
  const [notingId, setNotingId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getMyPlan()
      .then((data) => !cancelled && setPlan(data))
      .catch((err) => !cancelled && setLoadError(err.message));

    return () => {
      cancelled = true;
    };
  }, []);

  // The plan may have moved under this page, so a refused write is followed by the server's
  // own answer rather than by leaving what is on screen.
  const run = async (call, after) => {
    setBusy(true);
    setActionError("");
    try {
      setPlan(await call());
      after?.();
    } catch (err) {
      setActionError(err.message);
      if (err.status === 409) {
        getMyPlan()
          .then(setPlan)
          .catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <Shell>
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {loadError}
        </p>
      </Shell>
    );
  }

  if (!plan) {
    return (
      <Shell>
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      </Shell>
    );
  }

  if (plan.state !== "plan") {
    return (
      <Shell>
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          {NOTHING_TO_READ[plan.state] || NOTHING_TO_READ.no_review}
        </p>
      </Shell>
    );
  }

  return (
    <>
      <PageHeader
        title="My development plan"
        context={[
          plan.sharedAt && `Shared ${formatDate(plan.sharedAt)}`,
          plan.acknowledgedAt && `Acknowledged ${formatDate(plan.acknowledgedAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        backTo="/dashboard"
      />

      <FormShell>
        <FormSection letter="A" title="Your actions">
          {actionError && (
            <p role="alert" className="mb-3 text-sm text-danger">
              {actionError}
            </p>
          )}

          <ul className="grid gap-3">
            {plan.actions.map((action) => (
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

                {plan.canAddNote &&
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
                          onClick={() =>
                            run(
                              () => addProgressNote(action.id, noteText.trim()),
                              () => {
                                setNotingId(null);
                                setNoteText("");
                              },
                            )
                          }
                        >
                          {busy ? "Saving…" : "Add note"}
                        </button>
                        <button
                          type="button"
                          className={secondaryClass}
                          disabled={busy}
                          onClick={() => {
                            setNotingId(null);
                            setNoteText("");
                          }}
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
                        setActionError("");
                      }}
                      className="mt-3 cursor-pointer text-[13px] text-brand transition-colors hover:underline"
                    >
                      Add a progress note
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </FormSection>

        <FormSection letter="B" title="Check-ins" note="Recorded by your supervisor.">
          <CheckInEntries entries={plan.checkIns} />
        </FormSection>

        <FormSection letter="C" title="Acknowledge this plan">
          {plan.acknowledgedAt ? (
            <p className="max-w-prose text-sm text-muted">
              You acknowledged this plan on {formatDate(plan.acknowledgedAt)}.
            </p>
          ) : (
            <>
              <p className="max-w-prose text-sm text-muted">
                Acknowledging records that you have read the plan, not that you agree with
                it. It cannot be undone.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {confirming ? (
                  <>
                    <button
                      type="button"
                      className={primaryClass}
                      disabled={busy}
                      onClick={() => run(acknowledgeMyPlan, () => setConfirming(false))}
                    >
                      {busy ? "Recording…" : "Yes, I have read it"}
                    </button>
                    <button
                      type="button"
                      className={secondaryClass}
                      disabled={busy}
                      onClick={() => setConfirming(false)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={primaryClass}
                    disabled={!plan.canAcknowledge}
                    onClick={() => setConfirming(true)}
                  >
                    Acknowledge this plan
                  </button>
                )}
              </div>
            </>
          )}
        </FormSection>
      </FormShell>
    </>
  );
}
