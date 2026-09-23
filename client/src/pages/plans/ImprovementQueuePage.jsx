import { useEffect, useState } from "react";
import { getImprovementQueue, decidePlan } from "../../services/plans";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";
import { ImprovementDetails } from "../../components/plans/ImprovementPlan";
import { formatDate } from "../../utils/dates";
import { categoryLabel } from "../../utils/planLabels";

// ⚠️ What an officer may decide, not what they may read: the server drops anyone outside
// their coverage and anyone in their own reporting line before the list is built.

export default function ImprovementQueuePage() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState("");

  const load = () =>
    getImprovementQueue()
      .then((data) => setPlans(data.plans))
      .catch((err) => setError(err.message));

  useEffect(() => {
    let cancelled = false;

    getImprovementQueue()
      .then((data) => !cancelled && setPlans(data.plans))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, []);

  const decide = async (plan, decision) => {
    setBusy(plan.id);
    setError("");

    try {
      await decidePlan(plan.id, decision, reasons[plan.id] || "");
      setReasons({ ...reasons, [plan.id]: "" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <PageHeader title="Improvement plans to decide" backTo="/dashboard" />

      <p className="mb-6 max-w-prose text-sm text-muted">
        A plan reaches the employee only after an officer approves it. Sending one back
        needs a written reason.
      </p>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {!plans ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      ) : plans.length === 0 ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Nothing is waiting on you.
        </p>
      ) : (
        <div className="grid gap-5">
          {plans.map((plan) => (
            <FormSection
              key={plan.id}
              title={plan.employee?.name}
              note={`Written by ${plan.createdBy?.name || "their supervisor"} · sent ${formatDate(plan.improvement?.submittedAt)}`}
            >
              <ImprovementDetails plan={plan} />

              <ul className="grid gap-3">
                {plan.actions.map((action) => (
                  <li
                    key={action.id}
                    className="rounded-lg border border-line p-4 text-sm"
                  >
                    <p className="font-medium text-ink">{action.description}</p>

                    <p className="mt-2 text-[13px] text-muted">
                      {categoryLabel(action.category)} · {action.competencyName} ·{" "}
                      {action.owner?.name || "Not recorded"} · due{" "}
                      {formatDate(action.targetDate)}
                    </p>

                    <p className="mt-2 text-[13px] text-muted">
                      <span className="font-medium text-ink">Success criterion: </span>
                      {action.successCriteria}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-line pt-4">
                <label
                  htmlFor={`reason-${plan.id}`}
                  className="mb-1.5 block text-[13px] font-medium text-ink"
                >
                  Reason for sending it back
                </label>

                <textarea
                  id={`reason-${plan.id}`}
                  rows={2}
                  value={reasons[plan.id] || ""}
                  onChange={(e) => setReasons({ ...reasons, [plan.id]: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                />

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={busy === plan.id}
                    onClick={() => decide(plan, "approved")}
                    className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
                  >
                    Approve
                  </button>

                  {/* Hides the way in, never protects it: the server refuses an empty reason too. */}
                  <button
                    type="button"
                    disabled={busy === plan.id || !(reasons[plan.id] || "").trim()}
                    onClick={() => decide(plan, "refused")}
                    className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send it back
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
