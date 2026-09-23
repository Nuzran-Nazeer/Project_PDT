import { useEffect, useState } from "react";
import {
  getMyImprovementPlans,
  acknowledgeMyImprovementPlan,
  addProgressNote,
} from "../../services/plans";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import { FormShell, FormSection } from "../../components/shells/FormShell";
import { CheckInEntries } from "../../components/plans/CheckIns";
import EmployeeActions from "../../components/plans/EmployeeActions";
import { planOutcomeLabel, daysRemainingLabel } from "../../utils/planLabels";

// ⚠️ Carries no score, no competency, no case type and no name but the supervisor's, and
// neither does the response behind it. Closed plans stay here, which is the one page whose
// access outlasts the plan.

const primaryClass =
  "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass =
  "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";

function Shell({ children }) {
  return (
    <>
      <PageHeader title="My improvement plan" backTo="/dashboard" />
      {children}
    </>
  );
}

export default function MyImprovementPlanPage() {
  const [plans, setPlans] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getMyImprovementPlans()
      .then((data) => !cancelled && setPlans(data.plans))
      .catch((err) => !cancelled && setLoadError(err.message));

    return () => {
      cancelled = true;
    };
  }, []);

  // A refused write is followed by the server's own answer rather than by leaving what is
  // on screen: the plan may have closed or been extended under this page.
  const run = async (call, after) => {
    setBusy(true);
    setActionError("");

    try {
      setPlans((await call()).plans);
      after?.();
    } catch (err) {
      setActionError(err.message);
      if (err.status === 409) {
        getMyImprovementPlans()
          .then((data) => setPlans(data.plans))
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

  if (!plans) {
    return (
      <Shell>
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      </Shell>
    );
  }

  const open = plans.find((plan) => plan.status !== "closed");
  const history = plans.filter((plan) => plan.status === "closed");

  if (!open && history.length === 0) {
    return (
      <Shell>
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          You have no improvement plan.
        </p>
      </Shell>
    );
  }

  return (
    <>
      <PageHeader
        title="My improvement plan"
        context={
          open
            ? [
                `Runs ${formatDate(open.startDate)} to ${formatDate(open.endDate)}`,
                daysRemainingLabel(open.daysRemaining),
                open.acknowledgedAt && `Read ${formatDate(open.acknowledgedAt)}`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Closed"
        }
        backTo="/dashboard"
      />

      <FormShell>
        {open ? (
          <>
            <FormSection letter="A" title="What is expected of you">
              <EmployeeActions
                actions={open.actions}
                canAddNote={open.canAddNote}
                busy={busy}
                error={actionError}
                onStartNote={() => setActionError("")}
                onAddNote={(actionId, text, done) =>
                  run(() => addProgressNote(actionId, text), done)
                }
              />
            </FormSection>

            <FormSection letter="B" title="Meetings" note="Recorded by your supervisor.">
              <CheckInEntries entries={open.checkIns} />
            </FormSection>

            <FormSection letter="C" title="Record that you have read it">
              {open.acknowledgedAt ? (
                <p className="max-w-prose text-sm text-muted">
                  You recorded that you read this plan on{" "}
                  {formatDate(open.acknowledgedAt)}.
                </p>
              ) : (
                <>
                  <p className="max-w-prose text-sm text-muted">
                    This records that you have read the plan, not that you agree with it.
                    The plan is already running either way, and this cannot be undone.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {confirming ? (
                      <>
                        <button
                          type="button"
                          className={primaryClass}
                          disabled={busy}
                          onClick={() =>
                            run(acknowledgeMyImprovementPlan, () => setConfirming(false))
                          }
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
                        disabled={!open.canAcknowledge}
                        onClick={() => setConfirming(true)}
                      >
                        I have read this plan
                      </button>
                    )}
                  </div>
                </>
              )}
            </FormSection>
          </>
        ) : null}

        {history.length > 0 && (
          <FormSection letter={open ? "D" : "A"} title="Earlier plans">
            <ul className="grid gap-3">
              {history.map((plan) => (
                <li key={plan.id} className="rounded-lg border border-line p-4 text-sm">
                  <p className="font-medium text-ink">
                    {formatDate(plan.startDate)} to {formatDate(plan.endDate)} ·{" "}
                    {planOutcomeLabel(plan.outcome)}
                  </p>

                  {plan.outcomeReason && (
                    <p className="mt-2 whitespace-pre-line text-[13px] text-muted">
                      {plan.outcomeReason}
                    </p>
                  )}

                  <p className="mt-2 text-[13px] text-muted">
                    Closed {formatDate(plan.closeDate)} · {plan.actions.length} actions ·{" "}
                    {plan.checkIns.length} meetings
                  </p>
                </li>
              ))}
            </ul>
          </FormSection>
        )}
      </FormShell>
    </>
  );
}
