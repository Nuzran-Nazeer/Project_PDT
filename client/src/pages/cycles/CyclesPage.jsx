import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { buildCycleSchema } from "../../schemas/cycleSchema";
import {
  listCycles,
  createCycle,
  advanceCycle,
  cancelCycle,
} from "../../services/cycles";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";

// Running the appraisal cycle: create one, open it, move it on, cancel it.
//
// THE MOCKUPS DO NOT DRAW THIS SCREEN. All thirty cover the six dashboards and their
// tabs, and none shows HR creating a cycle — so this follows the house style of the
// organisation tree rather than a design, and stays plain on purpose.
//
// EVERY RULE HERE IS THE SERVER'S. This page shows what is worth offering; it decides
// nothing. The one-per-group check, the stage order, the 30-day window and the written
// reason all live in the service, and the buttons below only hide what would be
// refused. A rule enforced by a hidden button is not enforced at all.
//
// The refusals are shown in the server's own words, never reworded. "This one is
// collecting" and "opened 40 days ago" name the rule that stopped you, which a generic
// "could not cancel" would throw away.

// The stages, in order, so the page can say what the next move is called. It is the
// same list the server holds; here it is only ever used for LABELS, never to decide
// whether a move is allowed.
const STAGE_LABELS = {
  draft: "Draft",
  open: "Open",
  collecting: "Collecting",
  supervisor_review: "Supervisor review",
  normalising: "Normalising",
  published: "Published",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STAGE_ORDER = [
  "draft",
  "open",
  "collecting",
  "supervisor_review",
  "normalising",
  "published",
  "closed",
];

const nextStage = (status) => {
  const at = STAGE_ORDER.indexOf(status);
  return at === -1 ? null : STAGE_ORDER[at + 1] || null;
};

const STAGE_TONE = {
  draft: "border-line text-muted",
  cancelled: "border-danger/40 text-danger",
  closed: "border-line text-muted",
};

const blankForm = () => ({
  parGroup: "",
  year: String(new Date().getFullYear()),
  startDate: "",
  endDate: "",
});

export default function CyclesPage() {
  const { user, constants } = useAuth();

  // HR and the Head of HR run the cycle; Leadership reads it. The server enforces
  // exactly this, which is why the page can simply not draw the controls.
  const canManage = user?.roles?.some((role) => ["hr", "head_of_hr"].includes(role));

  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");

  const [cancelFor, setCancelFor] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  // Reloading after a change. Called from a click, never from an effect body, which
  // is why it can be a plain async function.
  const load = async () => {
    try {
      const data = await listCycles();
      setCycles(data.items || []);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // The first load is written as a promise chain rather than calling `load()`, because
  // setting state synchronously inside an effect body causes a second render pass on
  // every mount. `cancelled` stops a slow response writing into a screen that has
  // already gone. Same shape as every other list page here.
  useEffect(() => {
    let cancelled = false;

    listCycles()
      .then((data) => !cancelled && setCycles(data.items || []))
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const submitCreate = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    try {
      await buildCycleSchema(constants).validate(form, { abortEarly: false });
    } catch (validationError) {
      const errors = {};
      validationError.inner.forEach((err) => {
        if (err.path && !errors[err.path]) errors[err.path] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      await createCycle({ ...form, year: Number(form.year) });
      setShowCreate(false);
      setForm(blankForm());
      await load();
    } catch (err) {
      // The server's own words: a second live cycle for the same group and year names
      // the one that already exists and what stage it is at. Nothing on screen changes
      // — the cycle was never created, so there is nothing to undo.
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const move = async (cycle) => {
    const target = nextStage(cycle.status);
    if (!target) return;

    setBusyId(cycle._id);
    setActionError("");
    try {
      await advanceCycle(cycle._id, target);
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId("");
    }
  };

  const submitCancel = async (cycle) => {
    setBusyId(cycle._id);
    setActionError("");
    try {
      await cancelCycle(cycle._id, cancelReason);
      setCancelFor("");
      setCancelReason("");
      await load();
    } catch (err) {
      // Where the 30-day window is felt. The message names how long ago it opened,
      // which a reworded "could not cancel" would lose.
      setActionError(err.message);
    } finally {
      setBusyId("");
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink";
  const primaryClass =
    "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryClass =
    "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <>
      <PageHeader
        title="Appraisal cycles"
        context={
          canManage
            ? "One run of the review process for one appraisal group. Everything else hangs off it."
            : "One run of the review process for one appraisal group. Only HR can change these."
        }
      />

      {canManage && !showCreate && (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={primaryClass}
        >
          New cycle
        </button>
      )}

      {loadError && <Alert>{loadError}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}

      {showCreate && (
        <form
          onSubmit={submitCreate}
          className="mt-6 rounded-xl border border-line bg-raised p-5"
        >
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            New cycle
          </h2>

          {/* Created as a DRAFT, always. Opening it is a separate, deliberate step,
              because opening is what starts the 30-day cancellation clock. */}
          <p className="mt-2 max-w-prose text-[13px] text-muted">
            It is created as a draft. Opening it is a separate step, and that is what
            starts the 30 days in which it can still be cancelled.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="parGroup">
                Appraisal group
              </label>
              <select
                id="parGroup"
                className={inputClass}
                value={form.parGroup}
                onChange={(e) => setForm({ ...form, parGroup: e.target.value })}
              >
                <option value="">Choose a group</option>
                {(constants?.parGroups || []).map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
              <FieldError>{fieldErrors.parGroup}</FieldError>
            </div>

            <div>
              <label className={labelClass} htmlFor="year">
                Year
              </label>
              <input
                id="year"
                className={inputClass}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
              />
              <FieldError>{fieldErrors.year}</FieldError>
            </div>

            <div>
              <label className={labelClass} htmlFor="startDate">
                Period start
              </label>
              <input
                id="startDate"
                type="date"
                className={inputClass}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
              <FieldError>{fieldErrors.startDate}</FieldError>
            </div>

            <div>
              <label className={labelClass} htmlFor="endDate">
                Period end
              </label>
              <input
                id="endDate"
                type="date"
                className={inputClass}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
              <FieldError>{fieldErrors.endDate}</FieldError>
            </div>
          </div>

          {formError && <Alert>{formError}</Alert>}

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className={primaryClass}>
              {saving ? "Creating…" : "Create draft"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setFieldErrors({});
                setFormError("");
              }}
              className={secondaryClass}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 grid gap-3">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : cycles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
            No cycle has been created yet. Nothing above a cycle can exist until one does
            — no review, no feedback, no development plan.
          </p>
        ) : (
          cycles.map((cycle) => {
            const target = nextStage(cycle.status);
            const cancellable = cycle.status === "draft" || cycle.status === "open";

            return (
              <article
                key={cycle._id}
                className="rounded-xl border border-line bg-raised p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-semibold text-ink">
                    {cycle.parGroup} group · {cycle.year}
                  </h2>

                  <span
                    className={`rounded-lg border px-2.5 py-1 text-[12px] ${
                      STAGE_TONE[cycle.status] || "border-brand/40 text-brand"
                    }`}
                  >
                    {STAGE_LABELS[cycle.status] || cycle.status}
                  </span>

                  <span className="text-[13px] text-muted">
                    {formatDate(cycle.startDate)} to {formatDate(cycle.endDate)}
                  </span>
                </div>

                {cycle.openedOn && (
                  <p className="mt-2 text-[13px] text-muted">
                    Opened {formatDate(cycle.openedOn)}
                    {cycle.openedBy?.name ? ` by ${cycle.openedBy.name}` : ""}.
                  </p>
                )}

                {/* Shown, not hidden. A cancelled cycle stays in the list with the
                    reason it was cancelled, because that is the record of a decision
                    somebody made — and nothing here is ever deleted. */}
                {cycle.status === "cancelled" && (
                  <p className="mt-2 text-[13px] text-muted">
                    Cancelled {formatDate(cycle.cancelledOn)}
                    {cycle.cancelledBy?.name ? ` by ${cycle.cancelledBy.name}` : ""}:{" "}
                    <span className="text-ink">{cycle.cancelReason}</span>
                  </p>
                )}

                {canManage && (target || cancellable) && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {target && (
                      <button
                        type="button"
                        disabled={busyId === cycle._id}
                        onClick={() => move(cycle)}
                        className={secondaryClass}
                      >
                        {cycle.status === "draft"
                          ? "Open this cycle"
                          : `Move to ${STAGE_LABELS[target].toLowerCase()}`}
                      </button>
                    )}

                    {cancellable && cancelFor !== cycle._id && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelFor(cycle._id);
                          setCancelReason("");
                          setActionError("");
                        }}
                        className={secondaryClass}
                      >
                        Cancel this cycle
                      </button>
                    )}
                  </div>
                )}

                {cancelFor === cycle._id && (
                  <div className="mt-4 rounded-lg border border-line p-4">
                    <label className={labelClass} htmlFor={`reason-${cycle._id}`}>
                      Why is this cycle being cancelled?
                    </label>
                    {/* Required, and required for a reason: a cancellation is a
                        decision somebody has to be able to defend later. The server
                        refuses without one, so this field is not a formality. */}
                    <textarea
                      id={`reason-${cycle._id}`}
                      rows={2}
                      className={inputClass}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="This is stored with the cycle and cannot be edited afterwards."
                    />

                    <p className="mt-2 text-[13px] text-muted">
                      A cycle can only be cancelled within 30 days of opening, and never
                      once it has moved past open. It is never deleted.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busyId === cycle._id}
                        onClick={() => submitCancel(cycle)}
                        className={primaryClass}
                      >
                        {busyId === cycle._id ? "Cancelling…" : "Cancel the cycle"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelFor("")}
                        className={secondaryClass}
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </>
  );
}

function Alert({ children }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
    >
      {children}
    </p>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[13px] text-danger">{children}</p>;
}
