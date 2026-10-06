import { useEffect, useState } from "react";
import { getOpenEscalations, closeEscalatedPlan } from "../../services/plans";
import WorkflowNotice from "../../components/common/WorkflowNotice";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";
import { ImprovementPlanSummary } from "../../components/plans/ImprovementPlan";
import { formatDate } from "../../utils/dates";
import { IMPROVEMENT_HR_OUTCOMES, outcomeChoiceLabel } from "../../utils/planLabels";

// ⚠️ An escalated plan stays open until an officer closes it. Listed rather than waited on:
// an escalation with no closing entry leaves every count in the system wrong.

const EMPTY = { outcome: "", note: "" };

export default function OpenEscalationsPage() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState("");
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState("");

  const load = () =>
    getOpenEscalations()
      .then((data) => setPlans(data.plans))
      .catch((err) => setError(err.message));

  useEffect(() => {
    let cancelled = false;

    getOpenEscalations()
      .then((data) => !cancelled && setPlans(data.plans))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, []);

  const formFor = (planId) => forms[planId] || EMPTY;

  const close = async (plan) => {
    setBusy(plan.id);
    setError("");

    try {
      await closeEscalatedPlan(plan.id, formFor(plan.id));
      setForms({ ...forms, [plan.id]: EMPTY });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <PageHeader
        title="Open escalations"
        context={
          plans && !error
            ? `${plans.length} awaiting an outcome within your coverage`
            : "Resolve escalated improvement plans"
        }
        backTo="/dashboard"
      />

      <p className="mb-6 max-w-prose text-sm text-muted">
        A supervisor has escalated these plans. Each stays open until you record how it
        ended.
      </p>

      {error && (
        <WorkflowNotice tone="error" className="mb-5">
          {error}
        </WorkflowNotice>
      )}

      {!plans ? (
        error ? null : (
          <WorkflowNotice tone="loading">Loading...</WorkflowNotice>
        )
      ) : plans.length === 0 ? (
        <WorkflowNotice>No plans are waiting on you.</WorkflowNotice>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-5">
          {plans.map((plan) => (
            <FormSection
              key={plan.id}
              title={plan.employee?.name}
              note={`Escalated ${formatDate(plan.improvement?.escalation?.at)} by ${plan.improvement?.escalation?.by?.name || "their supervisor"}`}
            >
              <ImprovementPlanSummary plan={plan} />

              <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 border-t border-line pt-4">
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`outcome-${plan.id}`}
                      className="mb-1.5 block text-[13px] font-medium text-ink"
                    >
                      How it ended
                    </label>

                    <select
                      id={`outcome-${plan.id}`}
                      value={formFor(plan.id).outcome}
                      onChange={(e) =>
                        setForms({
                          ...forms,
                          [plan.id]: { ...formFor(plan.id), outcome: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                    >
                      <option value="">Choose an outcome</option>
                      {IMPROVEMENT_HR_OUTCOMES.map((key) => (
                        <option key={key} value={key}>
                          {outcomeChoiceLabel(key)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`note-${plan.id}`}
                    className="mb-1.5 block text-[13px] font-medium text-ink"
                  >
                    What happened
                  </label>

                  <textarea
                    id={`note-${plan.id}`}
                    rows={3}
                    value={formFor(plan.id).note}
                    onChange={(e) =>
                      setForms({
                        ...forms,
                        [plan.id]: { ...formFor(plan.id), note: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                </div>

                <div>
                  {/* Hides the way in, never protects it: the server refuses both of these too. */}
                  <button
                    type="button"
                    disabled={
                      busy === plan.id ||
                      !formFor(plan.id).outcome ||
                      !formFor(plan.id).note.trim()
                    }
                    onClick={() => close(plan)}
                    className="workflow-primary"
                  >
                    Close this plan
                  </button>
                </div>
              </div>
            </FormSection>
          ))}
        </div>
      )}
    </>
  );
}
