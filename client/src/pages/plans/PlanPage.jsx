import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  getPlan,
  addAction,
  editAction,
  removeAction,
  sharePlan,
  submitForApproval,
  recordImprovementOutcome,
  recordCheckIn,
  setActionStatus,
} from "../../services/plans";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";
import { CheckInEntries, CheckInSchedule } from "../../components/plans/CheckIns";
import { ClosureSummary, CarriedMarker } from "../../components/plans/PlanClosure";
import { ImprovementDetails } from "../../components/plans/ImprovementPlan";
import { formatDate, toDateInput, todayInput } from "../../utils/dates";
import {
  categoryLabel,
  actionStatusLabel,
  checkInOutcomeLabel,
  daysSinceLabel,
  carryReasonLabel,
  planStatusLabel,
  outcomeChoiceLabel,
  IMPROVEMENT_SUPERVISOR_OUTCOMES,
  CHECK_IN_OUTCOMES,
  CARRY_FORWARD_REASONS,
  TRACKABLE_STATUSES,
} from "../../utils/planLabels";

// The supervisor's view of both kinds of plan. ⚠️ This is the only view that carries the
// competency. The employee's own page and the response behind it never do.

const EMPTY = {
  description: "",
  category: "",
  fromCompetency: "",
  ownerId: "",
  targetDate: "",
  successCriteria: "",
  carryReason: "",
};

const EMPTY_CHECK_IN = { at: "", outcome: "", note: "" };

const EMPTY_OUTCOME = { outcome: "", note: "", days: "" };

export default function PlanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, constants } = useAuth();

  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [checkIn, setCheckIn] = useState({ ...EMPTY_CHECK_IN, at: todayInput() });
  const [ending, setEnding] = useState(EMPTY_OUTCOME);
  const [busy, setBusy] = useState(false);

  const categories = constants?.planActionCategories || [];

  useEffect(() => {
    let cancelled = false;

    getPlan(id)
      .then((data) => !cancelled && setPlan(data))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [id]);

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setMissing([]);
  };

  // ⚠️ The server names every empty field at once, and those names are shown against the
  // fields rather than summarised: a form that reveals one gap per attempt is unfinishable.
  const run = async (work) => {
    setBusy(true);
    setError("");
    setMissing([]);

    try {
      setPlan(await work());
      reset();
    } catch (err) {
      setError(err.message);
      setMissing(err.details || []);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    return run(() => (editingId ? editAction(id, editingId, form) : addAction(id, form)));
  };

  const submitCheckIn = (event) => {
    event.preventDefault();
    return run(async () => {
      const saved = await recordCheckIn(id, checkIn);
      setCheckIn({ ...EMPTY_CHECK_IN, at: todayInput() });
      return saved;
    });
  };

  const submitOutcome = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");
    setMissing([]);

    try {
      const saved = await recordImprovementOutcome(id, {
        outcome: ending.outcome,
        note: ending.note,
        ...(ending.outcome === "extended" ? { days: Number(ending.days) } : {}),
      });

      // ⚠️ A closed improvement plan is no longer the supervisor's to read, so staying here
      // would leave them on a page the next request refuses.
      if (saved.status === "closed") {
        navigate("/team-plans");
        return;
      }

      setPlan(saved);
      setEnding(EMPTY_OUTCOME);
    } catch (err) {
      setError(err.message);
      setMissing(err.details || []);
    } finally {
      setBusy(false);
    }
  };

  const startEditing = (action) => {
    setEditingId(action.id);
    setMissing([]);
    setForm({
      description: action.description,
      category: action.category,
      fromCompetency: action.fromCompetency,
      ownerId: action.owner?.id || "",
      targetDate: toDateInput(action.targetDate),
      successCriteria: action.successCriteria,
      carryReason: action.carryReason || "",
    });
  };

  if (error && !plan) {
    return (
      <>
        <PageHeader title="Development plan" backTo="/team-plans" />
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

  const isImprovement = plan.type === "PIP";
  const tracking = plan.status === "active";
  const canRecordCheckIn = plan.checkIns?.canRecord;

  // Only an action that arrived from a closed plan is ever asked for a carry reason.
  const editing = plan.actions.find((action) => action.id === editingId);
  const owing = plan.actions.filter((action) => action.owes);

  // A conversation that went off track is the second way into an improvement plan.
  const offTrack = (plan.checkIns?.entries || []).filter(
    (entry) => entry.outcome === "off_track",
  );

  const owners = [
    { id: plan.employee?.id, name: `${plan.employee?.name} (the employee)` },
    { id: user?._id, name: `${user?.name} (you)` },
  ].filter((owner) => owner.id);

  return (
    <>
      <PageHeader
        title={`${plan.employee?.name}'s ${isImprovement ? "improvement" : "development"} plan`}
        context={[
          planStatusLabel(plan.status),
          plan.sharedAt && `shared ${formatDate(plan.sharedAt)}`,
          plan.acknowledgedAt && `acknowledged ${formatDate(plan.acknowledgedAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <Link
        to="/team-plans"
        className="mb-6 inline-block text-sm text-muted transition-colors hover:text-brand"
      >
        ← Back to team plans
      </Link>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <ClosureSummary plan={plan} />
      <ImprovementDetails plan={plan} />

      <div className="grid gap-5">
        <FormSection
          letter="A"
          title="Actions"
          note="The employee sees the action, never the competency behind it."
        >
          {plan.actions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
              No actions yet. A plan with no actions cannot be shared.
            </p>
          ) : (
            <ul className="grid gap-3">
              {plan.actions.map((action) => (
                <li key={action.id} className="rounded-lg border border-line p-4 text-sm">
                  <p className="font-medium text-ink">{action.description}</p>

                  <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] text-muted sm:grid-cols-2">
                    <Row label="Category">{categoryLabel(action.category)}</Row>
                    <Row label="From competency">{action.competencyName}</Row>
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

                  <CarriedMarker action={action} />

                  {action.owes && (
                    <p className="mt-2 text-[13px] text-danger">
                      Still needs {owedLabel(action.owes)}.
                    </p>
                  )}

                  {tracking && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      <span className="text-[13px] font-medium text-ink">Move to</span>
                      {TRACKABLE_STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={busy || action.status === status}
                          onClick={() =>
                            run(() => setActionStatus(id, action.id, status))
                          }
                          className="cursor-pointer rounded-lg border border-line px-2.5 py-1 text-[13px] text-muted transition-colors hover:text-brand disabled:cursor-default disabled:border-brand disabled:text-brand disabled:opacity-100"
                        >
                          {actionStatusLabel(status)}
                        </button>
                      ))}
                    </div>
                  )}

                  {plan.canEdit && (
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() => startEditing(action)}
                        className="text-[13px] text-brand transition-colors hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => removeAction(id, action.id))}
                        className="text-[13px] text-danger transition-colors hover:underline disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        {plan.canEdit ? (
          <FormSection letter="B" title={editingId ? "Edit an action" : "Add an action"}>
            <form onSubmit={submit} className="grid gap-4">
              <Field
                label="What they will do"
                name="description"
                missing={missing}
                hint="Written by you. There is no library to pick from."
              >
                <textarea
                  id="description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={inputClass(missing, "description")}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" name="category" missing={missing}>
                  <select
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={inputClass(missing, "category")}
                  >
                    <option value="">Choose a category</option>
                    {categories.map((key) => (
                      <option key={key} value={key}>
                        {categoryLabel(key)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="From which competency"
                  name="fromCompetency"
                  missing={missing}
                  hint="Recorded against the action. The employee never sees it."
                >
                  <select
                    id="fromCompetency"
                    value={form.fromCompetency}
                    onChange={(e) => setForm({ ...form, fromCompetency: e.target.value })}
                    className={inputClass(missing, "fromCompetency")}
                  >
                    <option value="">Choose a competency</option>
                    {plan.competencies.map((competency) => (
                      <option key={competency.key} value={competency.key}>
                        {competency.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Owner" name="ownerId" missing={missing}>
                  <select
                    id="ownerId"
                    value={form.ownerId}
                    onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
                    className={inputClass(missing, "ownerId")}
                  >
                    <option value="">Choose an owner</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Target date"
                  name="targetDate"
                  missing={missing}
                  hint={
                    editing?.carriedTargetDate
                      ? `It arrived due ${formatDate(editing.carriedTargetDate)} and needs a new date.`
                      : undefined
                  }
                >
                  <input
                    id="targetDate"
                    type="date"
                    value={form.targetDate}
                    onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                    className={inputClass(missing, "targetDate")}
                  />
                </Field>

                {editing?.carriedTimes > 0 && (
                  <Field
                    label="Why it was not finished"
                    name="carryReason"
                    missing={missing}
                    hint="Recorded against the action. The employee never sees it."
                  >
                    <select
                      id="carryReason"
                      value={form.carryReason}
                      onChange={(e) => setForm({ ...form, carryReason: e.target.value })}
                      className={inputClass(missing, "carryReason")}
                    >
                      <option value="">Choose a reason</option>
                      {CARRY_FORWARD_REASONS.map((key) => (
                        <option key={key} value={key}>
                          {carryReasonLabel(key)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              <Field
                label="Success criterion"
                name="successCriteria"
                missing={missing}
                hint="How both of you will know it is done."
              >
                <textarea
                  id="successCriteria"
                  rows={2}
                  value={form.successCriteria}
                  onChange={(e) => setForm({ ...form, successCriteria: e.target.value })}
                  className={inputClass(missing, "successCriteria")}
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
                >
                  {editingId ? "Save the action" : "Add the action"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={reset}
                    className="text-sm text-muted transition-colors hover:text-brand"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </FormSection>
        ) : (
          <FormSection letter="B" title="Actions">
            <p className="text-sm text-muted">
              {plan.status === "closed"
                ? "This plan has closed, so its actions can no longer be changed."
                : "This plan has been shared, so its actions can no longer be changed."}
            </p>
          </FormSection>
        )}

        <FormSection
          letter="C"
          title={isImprovement ? "Approval and sharing" : "Share the plan"}
          note={
            isImprovement
              ? "HR approves it before the employee sees anything."
              : "Sharing sends it to the employee. Their acknowledgement is what makes it active."
          }
        >
          {plan.status === "closed" ? (
            <p className="text-sm text-muted">
              This plan closed on {formatDate(plan.closeDate)}.
            </p>
          ) : plan.status === "awaiting_approval" ? (
            <p className="text-sm text-muted">
              With HR for a decision. Nothing about it reaches {plan.employee?.name} yet,
              and its actions cannot be changed while it is there.
            </p>
          ) : isImprovement && plan.status === "draft" ? (
            <>
              <button
                type="button"
                disabled={busy || plan.actions.length === 0}
                onClick={() => run(() => submitForApproval(id))}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send to HR
              </button>

              {plan.actions.length === 0 && (
                <p className="mt-3 text-[13px] text-muted">
                  Add at least one action first.
                </p>
              )}
            </>
          ) : plan.status === "approved" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => sharePlan(id))}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
              >
                Share with {plan.employee?.name}
              </button>

              <p className="mt-3 text-[13px] text-muted">
                The start and end dates are set the moment you share it.
              </p>
            </>
          ) : plan.status !== "draft" ? (
            <p className="text-sm text-muted">
              Shared on {formatDate(plan.sharedAt)}, waiting for {plan.employee?.name} to
              acknowledge it.
            </p>
          ) : (
            <>
              {/* Hides the way in, never protects it: the server refuses both of these too. */}
              <button
                type="button"
                disabled={busy || plan.actions.length === 0 || owing.length > 0}
                onClick={() => run(() => sharePlan(id))}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Share with {plan.employee?.name}
              </button>

              {plan.actions.length === 0 && (
                <p className="mt-3 text-[13px] text-muted">
                  Add at least one action first.
                </p>
              )}

              {owing.length > 0 && (
                <p className="mt-3 text-[13px] text-muted">
                  {owing.length === 1
                    ? "One action carried forward still needs a reason and a new target date."
                    : `${owing.length} actions carried forward still need a reason and a new target date.`}
                </p>
              )}
            </>
          )}
        </FormSection>

        <FormSection letter="D" title="Check-ins">
          <CheckInSchedule summary={plan.checkIns} />

          <div className="mt-4">
            <CheckInEntries entries={plan.checkIns?.entries} />
          </div>

          {canRecordCheckIn ? (
            <form
              onSubmit={submitCheckIn}
              className="mt-4 grid gap-4 border-t border-line pt-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Date of the conversation"
                  name="at"
                  missing={missing}
                  hint="The day you spoke, which may not be today."
                >
                  <input
                    id="at"
                    type="date"
                    max={todayInput()}
                    value={checkIn.at}
                    onChange={(e) => setCheckIn({ ...checkIn, at: e.target.value })}
                    className={inputClass(missing, "at")}
                  />
                </Field>

                <Field label="Outcome" name="outcome" missing={missing}>
                  <select
                    id="outcome"
                    value={checkIn.outcome}
                    onChange={(e) => setCheckIn({ ...checkIn, outcome: e.target.value })}
                    className={inputClass(missing, "outcome")}
                  >
                    <option value="">Choose an outcome</option>
                    {CHECK_IN_OUTCOMES.map((key) => (
                      <option key={key} value={key}>
                        {checkInOutcomeLabel(key)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field
                label="Note"
                name="note"
                missing={missing}
                hint="What was discussed. This cannot be changed once recorded."
              >
                <textarea
                  id="note"
                  rows={3}
                  value={checkIn.note}
                  onChange={(e) => setCheckIn({ ...checkIn, note: e.target.value })}
                  className={inputClass(missing, "note")}
                />
              </Field>

              <div>
                <button
                  type="submit"
                  disabled={busy}
                  className="cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
                >
                  {busy ? "Recording…" : "Record the check-in"}
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
              {plan.status === "closed"
                ? "This plan has closed."
                : `Check-ins open once ${plan.employee?.name} acknowledges the plan.`}
            </p>
          )}
        </FormSection>

        {isImprovement && plan.improvement?.canClose && (
          <FormSection
            letter="E"
            title="End the plan"
            note="Completing or not completing it closes it. Extending and escalating do not."
          >
            <form onSubmit={submitOutcome} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Outcome" name="outcome" missing={missing}>
                  <select
                    id="outcome"
                    value={ending.outcome}
                    onChange={(e) => setEnding({ ...ending, outcome: e.target.value })}
                    className={inputClass(missing, "outcome")}
                  >
                    <option value="">Choose an outcome</option>
                    {IMPROVEMENT_SUPERVISOR_OUTCOMES.map((key) => (
                      <option
                        key={key}
                        value={key}
                        disabled={key === "extended" && !plan.improvement.canExtend}
                      >
                        {outcomeChoiceLabel(key)}
                      </option>
                    ))}
                  </select>
                </Field>

                {ending.outcome === "extended" && (
                  <Field
                    label="Extra days"
                    name="days"
                    missing={missing}
                    hint="30 to 90, counted from today."
                  >
                    <input
                      id="days"
                      type="number"
                      min={30}
                      max={90}
                      value={ending.days}
                      onChange={(e) => setEnding({ ...ending, days: e.target.value })}
                      className={inputClass(missing, "days")}
                    />
                  </Field>
                )}
              </div>

              <Field
                label="What happened"
                name="note"
                missing={missing}
                hint={
                  ending.outcome === "escalated"
                    ? "HR reads this, and they decide how the plan ends from here."
                    : "Recorded against the plan and shown to the employee."
                }
              >
                <textarea
                  id="note"
                  rows={3}
                  value={ending.note}
                  onChange={(e) => setEnding({ ...ending, note: e.target.value })}
                  className={inputClass(missing, "note")}
                />
              </Field>

              {!plan.improvement.canExtend && (
                <p className="text-[13px] text-muted">
                  This plan has already been extended once.
                </p>
              )}

              <div>
                <button
                  type="submit"
                  disabled={busy || !ending.outcome || !ending.note.trim()}
                  className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Recording…" : "Record the outcome"}
                </button>
              </div>
            </form>
          </FormSection>
        )}

        {isImprovement && plan.improvement?.escalation && (
          <FormSection letter="E" title="End the plan">
            <p className="text-sm text-muted">
              This plan has been escalated, so HR records how it ends.
            </p>
          </FormSection>
        )}

        {/* ⚠️ Only on a development plan, and never on the employee's page or HR's read.
            An improvement plan is not started from another improvement plan. */}
        {!isImprovement && (
          <FormSection
            letter="E"
            title="Improvement plan"
            note="A formal route for a serious concern. HR approves it before the employee sees it."
          >
            <Link
              to={`/team-plans/${id}/improvement`}
              className="text-sm text-brand transition-colors hover:underline"
            >
              Start one from the published result
            </Link>

            {offTrack.length > 0 && (
              <ul className="mt-3 grid gap-2 border-t border-line pt-3">
                {offTrack.map((entry) => (
                  <li key={entry.number} className="text-[13px]">
                    <Link
                      to={`/team-plans/${id}/improvement?checkIn=${entry.number}`}
                      className="text-brand transition-colors hover:underline"
                    >
                      Start one from check-in {entry.number}
                    </Link>
                    <span className="text-muted"> · {formatDate(entry.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>
        )}
      </div>
    </>
  );
}

// The server names what a carried action is short of: one of these, or both.
const OWED_LABELS = {
  carryReason: "a reason",
  targetDate: "a new target date",
};

const owedLabel = (owes) => owes.map((key) => OWED_LABELS[key] || key).join(" and ");

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

function Row({ label, children }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium text-ink">{label}:</dt>
      <dd>{children}</dd>
    </div>
  );
}
