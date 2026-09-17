import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

// ⚠️ Every rule here is the server's; the buttons only hide what would be refused.

// Labels only, never to decide whether a move is allowed.
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
  // What the move into normalising or published did, with every review it left waiting.
  const [outcome, setOutcome] = useState(null);

  const [publishFor, setPublishFor] = useState("");

  const [cancelFor, setCancelFor] = useState("");
  const [cancelReason, setCancelReason] = useState("");

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

  // A promise chain rather than `load()`: state set in an effect body costs a second render pass.
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
    setOutcome(null);
    try {
      const result = await advanceCycle(cycle._id, target);
      if (result?.normalisation) {
        setOutcome({ cycle, kind: "normalisation", ...result.normalisation });
      }
      if (result?.publication) {
        setOutcome({ cycle, kind: "publication", ...result.publication });
        setPublishFor("");
      }
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
      {outcome && <MoveOutcome outcome={outcome} />}

      {showCreate && (
        <form
          onSubmit={submitCreate}
          className="mt-6 rounded-xl border border-line bg-raised p-5"
        >
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            New cycle
          </h2>

          <p className="mt-2 max-w-prose text-[13px] text-muted">
            Created as a draft. Opening it starts the 30 days in which it can be
            cancelled.
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
            No cycle has been created yet.
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

                {/* ⚠️ Today's count on every card, a closed cycle included. */}
                <p className="mt-2 text-[13px] text-muted">
                  {cycle.peopleCount}{" "}
                  {cycle.peopleCount === 1 ? "person is" : "people are"} in the{" "}
                  {cycle.parGroup} group today.
                </p>

                {cycle.openedOn && (
                  <p className="mt-2 text-[13px] text-muted">
                    Opened {formatDate(cycle.openedOn)}
                    {cycle.openedBy?.name ? ` by ${cycle.openedBy.name}` : ""}.
                  </p>
                )}

                {cycle.status === "cancelled" && (
                  <p className="mt-2 text-[13px] text-muted">
                    Cancelled {formatDate(cycle.cancelledOn)}
                    {cycle.cancelledBy?.name ? ` by ${cycle.cancelledBy.name}` : ""}:{" "}
                    <span className="text-ink">{cycle.cancelReason}</span>
                  </p>
                )}

                {/* Not nested inside `canManage`: the first control is for every reader. */}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link to={`/cycles/${cycle._id}/people`} className={secondaryClass}>
                    View the people
                  </Link>

                  {canManage && (
                    <>
                      {target === "published"
                        ? publishFor !== cycle._id && (
                            <button
                              type="button"
                              disabled={busyId === cycle._id}
                              onClick={() => {
                                setPublishFor(cycle._id);
                                setActionError("");
                                setOutcome(null);
                              }}
                              className={secondaryClass}
                            >
                              Publish the results
                            </button>
                          )
                        : target && (
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
                    </>
                  )}
                </div>

                {/* Its own step: publishing cannot be undone, and one click is how a stage move works. */}
                {publishFor === cycle._id && (
                  <div className="mt-4 rounded-lg border border-line p-4">
                    <p className="text-sm text-ink">
                      Publish every result in this cycle?
                    </p>
                    <p className="mt-2 max-w-prose text-[13px] text-muted">
                      Everyone in the {cycle.parGroup} group whose review is ready
                      receives their result at the same time, and it cannot be taken back.
                      A review that is not ready is left waiting, named, and can be
                      published on its own once it catches up.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busyId === cycle._id}
                        onClick={() => move(cycle)}
                        className={primaryClass}
                      >
                        {busyId === cycle._id ? "Publishing…" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPublishFor("")}
                        className={secondaryClass}
                      >
                        Not yet
                      </button>
                    </div>
                  </div>
                )}

                {cancelFor === cycle._id && (
                  <div className="mt-4 rounded-lg border border-line p-4">
                    <label className={labelClass} htmlFor={`reason-${cycle._id}`}>
                      Why is this cycle being cancelled?
                    </label>
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

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One notice for both moves: counts first, then every review left waiting, named.
function MoveOutcome({ outcome }) {
  const { cycle, kind, waiting = [] } = outcome;
  const title = `${cycle.parGroup} group · ${cycle.year}`;

  const counts =
    kind === "publication"
      ? [
          `${plural(outcome.published, "result", "results")} sent`,
          outcome.withdrawn > 0 &&
            `${outcome.withdrawn} withdrawn for having no unit and no supervisor review`,
          waiting.length > 0 && `${waiting.length} left waiting`,
        ]
      : [
          `${plural(outcome.carried, "review", "reviews")} carried into normalisation`,
          waiting.length > 0 && `${waiting.length} left waiting`,
        ];

  return (
    <div
      role="status"
      className="mt-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-[13px] text-success"
    >
      <p>
        {title} {kind === "publication" ? "is published" : "is normalising"}:{" "}
        {counts.filter(Boolean).join(", ")}.
      </p>

      {waiting.length > 0 && (
        <ul className="mt-2 grid gap-1 text-ink">
          {waiting.map((item) => (
            <li key={item.reviewId}>
              <span className="font-medium">{item.employee?.name}</span>
              {" · "}
              {item.supervisor
                ? `supervisor ${item.supervisor.name}`
                : "no supervisor appointed"}
              {" · "}
              {item.missing === "summary_check" ? "summary check" : "supervisor review"}
              {": "}
              {item.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
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
