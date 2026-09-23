import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getPlan, startImprovementPlan } from "../../services/plans";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";
import { formatDate } from "../../utils/dates";
import {
  checkInOutcomeLabel,
  IMPROVEMENT_PLAN_TYPES,
  IMPROVEMENT_MIN_DAYS,
  IMPROVEMENT_MAX_DAYS,
  improvementTypeLabel,
} from "../../utils/planLabels";

// Reached from the development plan, which is what carries both ways in: the review it was
// written against, and the check-ins held on it. ⚠️ The form takes no dates. They are fixed
// when the plan is shared, because HR's approval can take days.

const EMPTY = { improvementType: "", forCompetency: "", durationDays: "" };

export default function StartImprovementPlanPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState([]);
  const [busy, setBusy] = useState(false);

  // The check-in this was opened from, if any. Its position in the list is its number.
  const checkInNumber = Number(params.get("checkIn")) || null;

  useEffect(() => {
    let cancelled = false;

    getPlan(id)
      .then((data) => !cancelled && setPlan(data))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [id]);

  const submit = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");
    setMissing([]);

    const source = checkInNumber ? "check_in" : "review";

    try {
      const started = await startImprovementPlan({
        ...form,
        durationDays: Number(form.durationDays),
        source,
        ...(checkInNumber ? { planId: id, checkInNumber } : { reviewId: plan.reviewId }),
      });

      navigate(`/team-plans/${started.id}`);
    } catch (err) {
      setError(err.message);
      setMissing(err.details || []);
      setBusy(false);
    }
  };

  if (error && !plan) {
    return (
      <>
        <PageHeader title="Start an improvement plan" backTo="/team-plans" />
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      </>
    );
  }

  if (!plan) {
    return (
      <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
        Loading…
      </p>
    );
  }

  const checkIn = checkInNumber
    ? plan.checkIns?.entries?.find((entry) => entry.number === checkInNumber)
    : null;

  return (
    <>
      <PageHeader
        title={`Start an improvement plan for ${plan.employee?.name}`}
        context={
          checkIn ? `From check-in ${checkIn.number}` : "From the published result"
        }
      />

      <Link
        to={`/team-plans/${id}`}
        className="mb-6 inline-block text-sm text-muted transition-colors hover:text-brand"
      >
        ← Back to the development plan
      </Link>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="grid gap-5">
        {checkIn && (
          <FormSection letter="A" title="What this follows">
            <p className="text-sm text-ink">
              Check-in {checkIn.number} on {formatDate(checkIn.at)} ·{" "}
              {checkInOutcomeLabel(checkIn.outcome)}
            </p>
            <p className="mt-2 whitespace-pre-line text-[13px] text-muted">
              {checkIn.note}
            </p>
          </FormSection>
        )}

        <FormSection
          letter={checkIn ? "B" : "A"}
          title="The plan"
          note="HR approves it before it reaches the employee."
        >
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" name="improvementType" missing={missing}>
                <select
                  id="improvementType"
                  value={form.improvementType}
                  onChange={(e) => setForm({ ...form, improvementType: e.target.value })}
                  className={inputClass(missing, "improvementType")}
                >
                  <option value="">Choose a type</option>
                  {IMPROVEMENT_PLAN_TYPES.map((key) => (
                    <option key={key} value={key}>
                      {improvementTypeLabel(key)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Raised over"
                name="forCompetency"
                missing={missing}
                hint="The employee never sees this."
              >
                <select
                  id="forCompetency"
                  value={form.forCompetency}
                  onChange={(e) => setForm({ ...form, forCompetency: e.target.value })}
                  className={inputClass(missing, "forCompetency")}
                >
                  <option value="">Choose a competency</option>
                  {plan.competencies.map((competency) => (
                    <option key={competency.key} value={competency.key}>
                      {competency.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Length in days"
                name="durationDays"
                missing={missing}
                hint={`${IMPROVEMENT_MIN_DAYS} to ${IMPROVEMENT_MAX_DAYS}. The dates are set when you share it.`}
              >
                <input
                  id="durationDays"
                  type="number"
                  min={IMPROVEMENT_MIN_DAYS}
                  max={IMPROVEMENT_MAX_DAYS}
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                  className={inputClass(missing, "durationDays")}
                />
              </Field>
            </div>

            <div>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
              >
                {busy ? "Starting…" : "Start the plan"}
              </button>
            </div>
          </form>
        </FormSection>
      </div>
    </>
  );
}

const inputClass = (missing, name) =>
  `w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink ${
    missing.includes(name) ? "border-danger" : "border-line"
  }`;

function Field({ label, name, missing, hint, children }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {missing.includes(name) ? (
        <p className="mt-1 text-[12px] text-danger">This is required.</p>
      ) : (
        hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>
      )}
    </div>
  );
}
