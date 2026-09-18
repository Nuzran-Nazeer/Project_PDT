import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listCycles, getCyclePeople } from "../../services/cycles";
import { getCollected, revealAuthor } from "../../services/feedback";
import { formatDateTime } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";
import Icon from "../../components/common/Icon";

// ⚠️ Its own screen, not a control beside the feedback. A reveal sits behind choosing a cycle,
// a person and one response on purpose: an officer reading a summary is not meant to find this
// under their cursor, and asking for a name should take deciding to.
//
// ⚠️ Whether this officer may reveal is the server's answer, never worked out here: the rule
// turns on coverage and the reporting line, and a browser that guessed would be guessing about
// somebody's confidentiality.

const primaryClass =
  "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass =
  "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const selectClass =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export default function ReviewerIdentityPage() {
  const { user } = useAuth();

  const [cycles, setCycles] = useState(null);
  const [cycleId, setCycleId] = useState("");
  const [people, setPeople] = useState(null);
  const [personId, setPersonId] = useState("");
  const [responses, setResponses] = useState(null);
  const [error, setError] = useState("");
  const [loadingResponses, setLoadingResponses] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listCycles()
      .then((data) => !cancelled && setCycles(data.items || []))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, []);

  // Choosing a cycle drops whatever was open below it, so nothing on screen belongs to a
  // person who is no longer selected.
  const onCycle = async (id) => {
    setCycleId(id);
    setPersonId("");
    setPeople(null);
    setResponses(null);
    setError("");
    if (!id) return;

    try {
      const data = await getCyclePeople(id);
      setPeople(data.items || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const onPerson = async (id) => {
    setPersonId(id);
    setResponses(null);
    setError("");
    if (!id) return;

    const person = (people || []).find((p) => String(p._id) === String(id));
    if (!person?.review?.id) return;

    setLoadingResponses(true);
    try {
      setResponses(await getCollected(person.review.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingResponses(false);
    }
  };

  // The server already returns only the people this officer covers. Their own record comes
  // back regardless, as it does on every list, and is dropped here: nobody reveals on their
  // own appraisal, so offering it would only ever end in a refusal.
  const me = String(user?._id ?? user?.id ?? "");
  const withReviews = (people || []).filter((p) => p.review?.id && String(p._id) !== me);
  const person = withReviews.find((p) => String(p._id) === String(personId));

  return (
    <>
      <PageHeader
        title="Reviewer identity"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <p className="mb-4 max-w-prose text-sm text-muted">
        Colleague feedback is written on the promise that it cannot be traced back to
        whoever wrote it. Revealing a name breaks that promise for somebody who will never
        know it happened, so it is for a genuine reason to investigate and nothing
        lighter. Each reveal is asked for one response at a time and needs a reason in
        writing.
      </p>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger"
        >
          {error}
        </p>
      )}

      <div className="grid gap-5">
        <FormSection
          title="Which review"
          note="Only the people you cover are listed, and never yourself."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cycle"
                className="mb-1.5 block text-[13px] font-semibold text-ink"
              >
                Cycle
              </label>
              <select
                id="cycle"
                value={cycleId}
                onChange={(e) => onCycle(e.target.value)}
                className={selectClass}
              >
                <option value="">Choose a cycle…</option>
                {(cycles || []).map((cycle) => (
                  <option key={cycle._id} value={cycle._id}>
                    {cycle.parGroup} {cycle.year} · {cycle.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="person"
                className="mb-1.5 block text-[13px] font-semibold text-ink"
              >
                Whose feedback
              </label>
              <select
                id="person"
                value={personId}
                disabled={!cycleId || !people}
                onChange={(e) => onPerson(e.target.value)}
                className={selectClass}
              >
                <option value="">
                  {!cycleId
                    ? "Choose a cycle first…"
                    : !people
                      ? "Loading…"
                      : withReviews.length === 0
                        ? "Nobody you cover in this cycle has a review"
                        : "Choose a person…"}
                </option>
                {withReviews.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                    {p.designation ? ` · ${p.designation}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </FormSection>

        {personId && (
          <FormSection
            title={`Colleague responses about ${person?.name || "this person"}`}
            note="Labelled, never named, and shown only once enough colleagues are in."
          >
            {loadingResponses ? (
              <p className="text-[13px] text-muted">Loading…</p>
            ) : (
              <Responses responses={responses} reviewId={person?.review?.id} />
            )}
          </FormSection>
        )}
      </div>
    </>
  );
}

function Responses({ responses, reviewId }) {
  if (!responses) {
    return <p className="text-[13px] text-muted">Nothing to show for this person.</p>;
  }

  if (!responses.released) {
    return (
      <p className="rounded-lg border border-dashed border-line p-4 text-[13px] text-muted">
        {responses.reason === "below_minimum"
          ? "This review has no colleague section, so there is nothing to reveal."
          : `${responses.settledCount} of ${responses.assignedCount} in. Nothing is shown until ${responses.needed} more have settled.`}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {responses.items.map((item) => (
        <div key={item.id} className="rounded-lg border border-line p-4">
          <p className="text-sm font-medium text-ink">{item.id}&rsquo;s feedback</p>

          <div className="mt-2 grid gap-2 text-[13px]">
            <p className="max-w-prose whitespace-pre-wrap text-muted">
              <span className="text-ink">Strength: </span>
              {item.freeText?.strengths || "Nothing written."}
            </p>
            <p className="max-w-prose whitespace-pre-wrap text-muted">
              <span className="text-ink">To develop: </span>
              {item.freeText?.development || "Nothing written."}
            </p>
          </div>

          <Reveal reviewId={reviewId} label={item.id} />
        </div>
      ))}
    </div>
  );
}

function Reveal({ reviewId, label }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(null);

  const onReveal = async () => {
    setBusy(true);
    setError("");
    try {
      setRevealed(await revealAuthor(reviewId, label, reason));
      setAsking(false);
      setReason("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (revealed) {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand/5 px-3 py-2 text-[13px] text-ink">
        <Icon name="user" className="h-4 w-4 shrink-0 text-brand" />
        <span className="font-medium">{revealed.reviewerName}</span>
        <span className="text-muted">
          wrote this, {formatDateTime(revealed.submittedAt)}
        </span>
      </p>
    );
  }

  if (!asking) {
    return (
      <div className="mt-3">
        {error && (
          <p
            role="alert"
            className="mb-2 max-w-prose rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setError("");
            setAsking(true);
          }}
          className={secondaryClass}
        >
          Reveal who wrote this
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-line p-3">
      <label
        htmlFor={`reveal-reason-${label}`}
        className="mb-1.5 block text-[13px] font-semibold text-ink"
      >
        Why does this one need a name?
      </label>
      <textarea
        id={`reveal-reason-${label}`}
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What is being investigated, and why this response."
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />
      {error && (
        <p
          role="alert"
          className="mt-2 max-w-prose rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger"
        >
          {error}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !reason.trim()}
          onClick={onReveal}
          className={primaryClass}
        >
          {busy ? "Revealing…" : "Reveal this name"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setAsking(false);
            setReason("");
            setError("");
          }}
          className={secondaryClass}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
