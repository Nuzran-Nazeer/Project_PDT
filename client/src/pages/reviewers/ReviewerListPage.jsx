import { Fragment, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Icon from "../../components/common/Icon";
import {
  confirmReviewerList,
  decideListChange,
  drawReviewers,
  getReviewerList,
  searchAddable,
} from "../../services/reviewerLists";
import { stateLabel } from "../../utils/reviewerListStates";
import { formatDate } from "../../utils/dates";

// ⚠️ Every rule here is the server's. The buttons only follow the `can…` flags it sends.

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const primaryClass =
  "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass =
  "cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";

const CHANGE_STATUS = {
  pending: "Waiting for HR",
  approved: "Approved",
  refused: "Refused",
};

export default function ReviewerListPage() {
  const { reviewId } = useParams();
  const location = useLocation();
  const backTo = location.state?.from || "/reviewer-lists";

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReviewerList(reviewId)
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const [notice, setNotice] = useState("");

  // Confirming and drawing reshape the page under the button, so the outcome is shown at the top.
  const run = async (action, describe, { scroll = true } = {}) => {
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      const result = await action();
      setData(await getReviewerList(reviewId));
      setNotice(describe(result));
      if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setActionError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link
        to={backTo}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-brand"
      >
        <Icon name="arrowLeft" className="h-4 w-4" />
        Back
      </Link>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      ) : !data ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      ) : (
        <ListView
          data={data}
          busy={busy}
          run={run}
          actionError={actionError}
          notice={notice}
        />
      )}
    </>
  );
}

function ListView({ data, busy, run, actionError, notice }) {
  const state = stateLabel(data.state);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Colleague list for {data.reviewee?.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {[data.reviewee?.designation, `${data.cycle.parGroup} ${data.cycle.year} cycle`]
            .filter(Boolean)
            .join(" · ")}
          {" · "}
          <span className={state.tone}>{state.label}</span>
        </p>
      </header>

      {actionError && <Alert>{actionError}</Alert>}
      {notice && <Success>{notice}</Success>}

      {data.canConfirm ? (
        <ConfirmForm data={data} busy={busy} run={run} />
      ) : (
        <>
          {data.whyNot && (
            <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-[13px] text-ink">
              {data.whyNot}
            </p>
          )}
          <StatusNote data={data} />
          {data.candidates.length > 0 && (
            <>
              <p className="mt-6 text-[13px] text-muted">
                The pool drawn from, not the people who were asked.
              </p>
              <CandidateTable candidates={data.candidates} changes={data.changes} />
            </>
          )}
          {data.changes.length > 0 && <Changes data={data} busy={busy} run={run} />}
          {data.canDraw && data.preview && <Draw data={data} busy={busy} run={run} />}
        </>
      )}
    </>
  );
}

function StatusNote({ data }) {
  const text = {
    to_confirm:
      "Waiting for the supervisor to confirm this list. This is who the records show worked with them.",
    awaiting_hr: data.canDecide
      ? "The list is confirmed. Decide each requested change below before drawing."
      : "The list is confirmed. HR decides each requested change, then draws the reviewers.",
    ready_to_draw: data.canDraw
      ? null
      : "Every requested change has been decided. HR draws the reviewers next.",
    not_collecting: "Lists can only be worked on while the cycle is collecting.",
    already_chosen:
      "Colleague reviewers were chosen for this review before lists were confirmed.",
  }[data.state];

  if (data.drawn) {
    return (
      <Panel>
        <p className="text-sm text-ink">
          {data.drawn.count}{" "}
          {data.drawn.count === 1 ? "colleague was" : "colleagues were"} asked for
          feedback.
        </p>
        {data.drawn.shortfallAcknowledged && (
          <p className="mt-1 text-[13px] text-muted">
            The pool was small, and HR acknowledged that before drawing.
          </p>
        )}
        <p className="mt-1 text-[13px] text-muted">
          Who was picked is not shown to anyone.
        </p>
      </Panel>
    );
  }

  return text ? (
    <Panel>
      <p className="text-sm text-muted">{text}</p>
    </Panel>
  ) : null;
}

function CandidateTable({ candidates, changes, removals, onToggleRemoval, onReason }) {
  const changeFor = (id) =>
    changes.find((c) => c.type === "remove" && c.person?.id === id);

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-raised">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <Th>Name</Th>
            <Th>Designation</Th>
            <Th>Worked together through</Th>
            <Th>Period</Th>
            <Th>{onToggleRemoval ? "Request" : "Change"}</Th>
          </tr>
        </thead>
        <tbody>
          {candidates.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-5 text-muted">
                Nobody worked with them long enough.
              </td>
            </tr>
          )}
          {candidates.map((c) => {
            const id = c.person?.id;
            const change = changeFor(id);
            const marked = removals && id in removals;
            const removed = change?.status === "approved";
            return (
              <Fragment key={id}>
                <tr className="border-b border-line last:border-0">
                  <td
                    className={`px-4 py-3 font-medium ${removed ? "text-muted line-through" : "text-ink"}`}
                  >
                    {c.person?.name}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.person?.designation || "Not recorded"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.via
                      ? `${c.via.kind === "project" ? "Project" : "Unit"}: ${c.via.name || "unnamed"}`
                      : "Not recorded"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(c.sharedFrom)} to {formatDate(c.sharedTo)}
                  </td>
                  <td className="px-4 py-3">
                    {onToggleRemoval ? (
                      <button
                        type="button"
                        onClick={() => onToggleRemoval(id)}
                        className={secondaryClass}
                      >
                        {marked ? "Keep" : "Request removal"}
                      </button>
                    ) : change ? (
                      <span className="text-muted">
                        Removal {CHANGE_STATUS[change.status].toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                </tr>
                {marked && (
                  <tr className="border-b border-line">
                    <td colSpan={5} className="px-4 pb-4">
                      <label
                        className="mb-1.5 block text-[13px] font-semibold text-ink"
                        htmlFor={`remove-${id}`}
                      >
                        Why should {c.person?.name} be removed?
                      </label>
                      <input
                        id={`remove-${id}`}
                        className={inputClass}
                        value={removals[id]}
                        onChange={(e) => onReason(id, e.target.value)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConfirmForm({ data, busy, run }) {
  const [removals, setRemovals] = useState({});
  const [additions, setAdditions] = useState([]);
  const [formError, setFormError] = useState("");

  const toggleRemoval = (id) =>
    setRemovals((current) => {
      const next = { ...current };
      if (id in next) delete next[id];
      else next[id] = "";
      return next;
    });

  const submit = () => {
    const changes = [
      ...Object.entries(removals).map(([userId, reason]) => ({
        type: "remove",
        userId,
        reason,
      })),
      ...additions.map((a) => ({ type: "add", userId: a.person.id, reason: a.reason })),
    ];
    if (changes.some((c) => !c.reason.trim())) {
      setFormError("Every requested removal and addition needs a written reason.");
      return;
    }
    setFormError("");
    run(
      () => confirmReviewerList(data.reviewId, changes),
      () =>
        changes.length
          ? `List confirmed. ${changes.length} requested ${changes.length === 1 ? "change has" : "changes have"} gone to HR for a decision.`
          : "List confirmed. HR can now draw the reviewers.",
    );
  };

  const count = Object.keys(removals).length + additions.length;

  return (
    <>
      <Panel>
        <p className="text-sm text-ink">
          Check this is everyone who worked with {data.reviewee?.name} long enough.
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Any removal or addition needs a reason and takes effect once HR approves it.
        </p>
      </Panel>

      <CandidateTable
        candidates={data.candidates}
        changes={[]}
        removals={removals}
        onToggleRemoval={toggleRemoval}
        onReason={(id, reason) =>
          setRemovals((current) => ({ ...current, [id]: reason }))
        }
      />

      <AddPeople
        reviewId={data.reviewId}
        additions={additions}
        setAdditions={setAdditions}
      />

      {formError && <Alert>{formError}</Alert>}

      <div className="mt-6">
        <button type="button" disabled={busy} onClick={submit} className={primaryClass}>
          {busy
            ? "Confirming…"
            : count
              ? `Confirm with ${count} requested ${count === 1 ? "change" : "changes"}`
              : "Confirm the list"}
        </button>
      </div>
    </>
  );
}

function AddPeople({ reviewId, additions, setAdditions }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState({ q: "", items: [], error: "" });

  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchAddable(reviewId, term)
        .then(
          (result) => !cancelled && setFound({ q: term, items: result.items, error: "" }),
        )
        .catch(
          (err) => !cancelled && setFound({ q: term, items: [], error: err.message }),
        );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reviewId, term]);

  const current = found.q === term && term.length >= 2 ? found : null;
  const added = new Set(additions.map((a) => a.person.id));
  const results = (current?.items || []).filter((p) => !added.has(p.id));

  return (
    <section className="mt-6 rounded-xl border border-line bg-raised p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
        Request an addition
      </h2>
      <p className="mt-2 text-[13px] text-muted">
        For somebody missing from the records. Nobody in their reporting line.
      </p>

      <input
        type="search"
        aria-label="Search by name"
        placeholder="Search by name"
        className={`${inputClass} mt-4`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {term.length >= 2 && (
        <div className="mt-3">
          {!current ? (
            <p className="text-[13px] text-muted">Searching…</p>
          ) : current.error ? (
            <p className="text-[13px] text-danger">{current.error}</p>
          ) : results.length === 0 ? (
            <p className="text-[13px] text-muted">
              Nobody who could be added matches that name.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {results.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <span className="text-sm text-ink">
                    {person.name}
                    <span className="ml-2 text-[13px] text-muted">
                      {person.designation}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={secondaryClass}
                    onClick={() => {
                      setAdditions([...additions, { person, reason: "" }]);
                      setQ("");
                    }}
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {additions.length > 0 && (
        <ul className="mt-4 grid gap-3">
          {additions.map((a) => (
            <li key={a.person.id} className="rounded-lg border border-line p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink">{a.person.name}</span>
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() =>
                    setAdditions(additions.filter((x) => x.person.id !== a.person.id))
                  }
                >
                  Remove request
                </button>
              </div>
              <label
                className="mb-1.5 mt-3 block text-[13px] font-semibold text-ink"
                htmlFor={`add-${a.person.id}`}
              >
                Why should {a.person.name} be added?
              </label>
              <input
                id={`add-${a.person.id}`}
                className={inputClass}
                value={a.reason}
                onChange={(e) =>
                  setAdditions(
                    additions.map((x) =>
                      x.person.id === a.person.id ? { ...x, reason: e.target.value } : x,
                    ),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Changes({ data, busy, run }) {
  return (
    <section className="mt-6 rounded-xl border border-line bg-raised p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
        Requested changes
      </h2>
      <ul className="mt-4 grid gap-3">
        {data.changes.map((change) => (
          <li key={change.id} className="rounded-lg border border-line p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-ink">
                <span className="font-medium">
                  {change.type === "add" ? "Add" : "Remove"} {change.person?.name}
                </span>
                <span className="ml-2 text-[13px] text-muted">
                  {change.person?.designation}
                </span>
              </span>
              <span className="text-[13px] text-muted">
                {CHANGE_STATUS[change.status]}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-ink">{change.reason}</p>

            {data.canDecide && change.status === "pending" && (
              <div className="mt-3">
                {change.requestedByYou ? (
                  <p className="text-[13px] text-muted">
                    You requested this, so somebody else in HR has to decide it.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className={secondaryClass}
                      onClick={() =>
                        run(
                          () => decideListChange(data.reviewId, change.id, true),
                          () =>
                            `${change.person?.name}: ${change.type === "add" ? "addition" : "removal"} approved.`,
                          { scroll: false },
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className={secondaryClass}
                      onClick={() =>
                        run(
                          () => decideListChange(data.reviewId, change.id, false),
                          () =>
                            `${change.person?.name}: ${change.type === "add" ? "addition" : "removal"} refused.`,
                          { scroll: false },
                        )
                      }
                    >
                      Refuse
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Draw({ data, busy, run }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const p = data.preview;

  return (
    <section className="mt-6 rounded-xl border border-line bg-raised p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
        Draw the reviewers
      </h2>
      <p className="mt-3 text-sm text-ink">
        {p.available} {p.available === 1 ? "colleague is" : "colleagues are"} available
        after approved changes, leavers and the review load limits. The draw will ask{" "}
        {p.willAssign}, least-loaded first.
      </p>

      {p.needsAcknowledgement && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5">
          <p className="text-[13px] text-ink">
            {p.noColleagueSection
              ? `Only ${p.available} available, and at least ${p.required} are needed. This review will have no colleague section.`
              : `Only ${p.available} available, below the usual minimum. As a small pool it needs ${p.required}.`}
          </p>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            I acknowledge this and want to draw anyway
          </label>
        </div>
      )}

      <p className="mt-3 text-[13px] text-muted">
        Once drawn, the list cannot be drawn again, and nobody is shown who was picked.
      </p>

      <button
        type="button"
        disabled={busy || (p.needsAcknowledgement && !acknowledged)}
        onClick={() =>
          run(
            () => drawReviewers(data.reviewId, p.needsAcknowledgement),
            (result) =>
              `Reviewers chosen. ${result.assigned} ${result.assigned === 1 ? "colleague has" : "colleagues have"} been asked for feedback and will find it under Feedback I owe.${result.noColleagueSection ? " Too few were available, so this review will have no colleague section." : ""}`,
          )
        }
        className={`${primaryClass} mt-4`}
      >
        {busy ? "Drawing…" : "Draw reviewers"}
      </button>
    </section>
  );
}

function Panel({ children }) {
  return <div className="rounded-xl border border-line bg-raised p-5">{children}</div>;
}

function Success({ children }) {
  return (
    <p
      role="status"
      className="mb-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-[13px] font-medium text-ink"
    >
      {children}
    </p>
  );
}

function Alert({ children }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
    >
      {children}
    </p>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </th>
  );
}
