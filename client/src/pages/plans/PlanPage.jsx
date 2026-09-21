import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  getPlan,
  addAction,
  editAction,
  removeAction,
  sharePlan,
} from "../../services/plans";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";
import { formatDate, toDateInput } from "../../utils/dates";
import { categoryLabel, actionStatusLabel } from "../../utils/planLabels";

// The supervisor's view: every action shows the competency it came from and who owns it.
// ⚠️ This is the only view that carries the competency. The employee's own page and the
// response behind it never do.

const EMPTY = {
  description: "",
  category: "",
  fromCompetency: "",
  ownerId: "",
  targetDate: "",
  successCriteria: "",
};

export default function PlanPage() {
  const { id } = useParams();
  const { user, constants } = useAuth();

  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
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

  const owners = [
    { id: plan.employee?.id, name: `${plan.employee?.name} (the employee)` },
    { id: user?._id, name: `${user?.name} (you)` },
  ].filter((owner) => owner.id);

  return (
    <>
      <PageHeader
        title={`${plan.employee?.name}'s development plan`}
        context={[
          plan.status === "draft" ? "Draft" : "Shared, awaiting acknowledgement",
          plan.sharedAt && `shared ${formatDate(plan.sharedAt)}`,
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
                    <Row label="State">{actionStatusLabel(action.status)}</Row>
                  </dl>

                  <p className="mt-3 text-[13px] text-muted">
                    <span className="font-medium text-ink">Success criterion: </span>
                    {action.successCriteria}
                  </p>

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

                <Field label="Target date" name="targetDate" missing={missing}>
                  <input
                    id="targetDate"
                    type="date"
                    value={form.targetDate}
                    onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                    className={inputClass(missing, "targetDate")}
                  />
                </Field>
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
              This plan has been shared, so its actions can no longer be changed.
            </p>
          </FormSection>
        )}

        <FormSection
          letter="C"
          title="Share the plan"
          note="Sharing sends it to the employee. Their acknowledgement is what makes it active."
        >
          {plan.status !== "draft" ? (
            <p className="text-sm text-muted">
              Shared on {formatDate(plan.sharedAt)}, waiting for {plan.employee?.name} to
              acknowledge it.
            </p>
          ) : (
            <>
              {/* Hides the way in, never protects it: the server refuses an empty plan too. */}
              <button
                type="button"
                disabled={busy || plan.actions.length === 0}
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
            </>
          )}
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

function Row({ label, children }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium text-ink">{label}:</dt>
      <dd>{children}</dd>
    </div>
  );
}
