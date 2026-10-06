import WorkflowNotice from "../../components/common/WorkflowNotice";
import { useEffect, useState } from "react";
import { getMyPlan, acknowledgeMyPlan, addProgressNote } from "../../services/plans";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import { FormShell, FormSection } from "../../components/shells/FormShell";
import { CheckInEntries } from "../../components/plans/CheckIns";
import { SuspensionNotice } from "../../components/plans/PlanClosure";
import EmployeeActions from "../../components/plans/EmployeeActions";

// ⚠️ The competency behind an action never appears here and is not in the response. The
// supervisor's page is the only view that carries it.

const primaryClass = "workflow-primary";
const secondaryClass = "workflow-secondary";

// ⚠️ Says what happens to the work, never why an action went unfinished: that reason is
// recorded for the supervisor and HR alone.
const CLOSED_OUTCOME = {
  completed: "Every action on it was completed.",
  carried_forward: "Anything unfinished carries into your next plan.",
  not_completed: "It closed with actions unfinished.",
};

const NOTHING_TO_READ = {
  no_review: "No result has been published for you yet.",
  no_plan: "No plan has been written against your published result yet.",
};

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
        <WorkflowNotice tone="error">{loadError}</WorkflowNotice>
      </Shell>
    );
  }

  if (!plan) {
    return (
      <Shell>
        <WorkflowNotice tone="loading">Loading…</WorkflowNotice>
      </Shell>
    );
  }

  if (plan.state !== "plan") {
    return (
      <Shell>
        <WorkflowNotice>
          {NOTHING_TO_READ[plan.state] || NOTHING_TO_READ.no_review}
        </WorkflowNotice>
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
          plan.closeDate && `Closed ${formatDate(plan.closeDate)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        backTo="/dashboard"
      />

      <FormShell>
        <SuspensionNotice plan={plan} mine />

        {plan.status === "closed" && (
          <p className="rounded-xl border border-line bg-raised p-4 text-sm text-muted">
            This plan closed on {formatDate(plan.closeDate)}.{" "}
            {CLOSED_OUTCOME[plan.outcome]}
          </p>
        )}

        <FormSection letter="A" title="Your actions">
          <EmployeeActions
            actions={plan.actions}
            canAddNote={plan.canAddNote}
            busy={busy}
            error={actionError}
            onStartNote={() => setActionError("")}
            onAddNote={(actionId, text, done) =>
              run(() => addProgressNote(actionId, text), done)
            }
          />
        </FormSection>

        <FormSection letter="B" title="Check-ins" note="Recorded by your supervisor.">
          <CheckInEntries entries={plan.checkIns} />
        </FormSection>

        <FormSection letter="C" title="Acknowledge this plan">
          {plan.acknowledgedAt ? (
            <p className="max-w-prose text-sm text-muted">
              You acknowledged this plan on {formatDate(plan.acknowledgedAt)}.
            </p>
          ) : plan.status === "closed" ? (
            <p className="max-w-prose text-sm text-muted">
              This plan closed before it was acknowledged, so it can no longer be
              acknowledged.
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
