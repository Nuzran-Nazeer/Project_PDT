import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { clearSummary, getSummaryCheck, sendBackSummary } from "../../services/reviews";
import { formatDateTime } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";
import CompetencyRatingField from "../../components/forms/CompetencyRatingField";
import TextAreaField from "../../components/forms/TextAreaField";
import Icon from "../../components/common/Icon";

// ⚠️ The responses are shown as the supervisor saw them: labelled, unnamed, untimed.
// Checking a summary needs what was said, never who said it.

const STATE_TEXT = {
  owed: "Owed. The supervisor's review has settled and this summary has not been cleared.",
  cleared: "Cleared. It can still be sent back until the review enters normalisation.",
  sent_back:
    "Sent back. The supervisor's review is a draft again; it is listed here once resubmitted and settled.",
  in_normalisation:
    "In normalisation. The summary was cleared and can no longer be sent back.",
  not_submitted: "The supervisor's review has not been submitted yet.",
  in_window:
    "The supervisor's review was submitted less than five hours ago and may still change.",
  no_section: "This review has no colleague section.",
};

const ACTION_LABEL = { cleared: "Cleared", sent_back: "Sent back" };

const valueFor = (item, key) => {
  const rating = (item.ratings || []).find((r) => r.competencyKey === key);
  return {
    score: rating?.score ?? null,
    evidence: rating?.evidence ?? "",
    notObserved: rating?.notObserved ?? false,
  };
};

const primaryClass =
  "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass =
  "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";

export default function SummaryCheckPage() {
  const { reviewId } = useParams();

  const [screen, setScreen] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [sendingBack, setSendingBack] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    let cancelled = false;

    getSummaryCheck(reviewId)
      .then((data) => !cancelled && setScreen(data))
      .catch((err) => !cancelled && setLoadError(err.message));

    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const run = async (action, message) => {
    setBusy(true);
    setActionError("");
    setDone("");
    try {
      setScreen(await action());
      setDone(message);
      setSendingBack(false);
      setReason("");
    } catch (err) {
      setActionError(err.message);
      // The state may have moved under this page; the server's answer replaces it.
      if (err.status === 409) {
        getSummaryCheck(reviewId)
          .then(setScreen)
          .catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  const onClear = () => run(() => clearSummary(reviewId), "Cleared.");
  const onSendBack = () =>
    run(
      () => sendBackSummary(reviewId, reason),
      "Sent back. The supervisor's review is open again.",
    );

  const header = (
    <>
      <PageHeader
        title="Check a colleague summary"
        context={
          screen
            ? [
                screen.employee?.name,
                screen.employee?.designation,
                screen.cycle && `${screen.cycle.parGroup} ${screen.cycle.year}`,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      />

      <Link
        to="/summaries-to-check"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-brand"
      >
        <Icon name="arrowLeft" className="h-4 w-4" />
        Back to summaries to check
      </Link>
    </>
  );

  if (loadError) {
    return (
      <>
        {header}
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {loadError}
        </p>
      </>
    );
  }

  if (!screen) {
    return (
      <>
        {header}
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      </>
    );
  }

  const { supervisorReview: review, responses, history, state } = screen;
  const summary = review.available ? review.colleagueSummary : null;
  const summaryEmpty = review.available && !(summary && summary.trim());

  return (
    <>
      {header}

      <p className="-mt-6 mb-6 max-w-prose text-[13px] text-muted">
        Supervisor:{" "}
        <span className="text-ink">{screen.supervisor?.name || "nobody appointed"}</span>
        {" · "}
        <span className="text-ink">{STATE_TEXT[state] || state}</span>
      </p>

      {done && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-[13px] text-success"
        >
          {done}
        </p>
      )}
      {actionError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
        >
          {actionError}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <FormSection
            title="The supervisor's summary"
            note="The only part of the colleague feedback the employee will read."
          >
            {!review.available ? (
              <p className="rounded-lg border border-dashed border-line p-4 text-[13px] text-muted">
                {review.reason === "in_window"
                  ? "Submitted less than five hours ago and may still change. It is shown once it settles."
                  : "Not submitted yet."}
              </p>
            ) : summaryEmpty ? (
              <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-[13px] text-amber-700 dark:text-amber-400">
                <Icon name="flag" className="h-4 w-4 shrink-0" />
                Nothing written. A colleague section exists, so the summary is owed.
              </p>
            ) : (
              <p className="max-w-prose whitespace-pre-wrap rounded-lg border border-line p-4 text-sm text-ink">
                {summary}
              </p>
            )}
          </FormSection>

          {review.available && (
            <details className="rounded-xl border border-line bg-raised p-5">
              <summary className="cursor-pointer text-[15px] font-semibold text-ink">
                The rest of the supervisor's review
              </summary>
              <p className="mt-1.5 max-w-prose text-[13px] text-muted">
                Read-only. Nothing here is checked; it is context for the summary.
              </p>

              <div className="mt-4 grid gap-4">
                {(review.competencies || []).map((competency) => (
                  <CompetencyRatingField
                    key={competency.key}
                    competency={competency}
                    value={valueFor(review, competency.key)}
                    readOnly
                  />
                ))}
                <TextAreaField
                  id="strengths"
                  label="Their strengths this cycle"
                  value={review.freeText?.strengths}
                  readOnly
                />
                <TextAreaField
                  id="development"
                  label="Where they should develop next"
                  value={review.freeText?.development}
                  readOnly
                />
              </div>
            </details>
          )}
        </div>

        <FormSection
          title="What colleagues said"
          note="Every released response, as the supervisor saw them. Labelled, never named."
        >
          <Responses responses={responses} />
        </FormSection>
      </div>

      {(screen.canClear || screen.canSendBack) && (
        <div className="mt-5 rounded-xl border border-line p-5">
          {sendingBack ? (
            <>
              <label
                htmlFor="send-back-reason"
                className="mb-1.5 block text-[13px] font-semibold text-ink"
              >
                Why is this summary being sent back?
              </label>
              <textarea
                id="send-back-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="The supervisor reads this at the top of their reopened review."
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              />
              <p className="mt-2 max-w-prose text-[13px] text-muted">
                The whole review reopens, not just the summary.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy || !reason.trim()}
                  onClick={onSendBack}
                  className={primaryClass}
                >
                  {busy ? "Sending back…" : "Send back"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSendingBack(false);
                    setReason("");
                  }}
                  className={secondaryClass}
                >
                  Keep checking
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {screen.canClear && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClear}
                  className={primaryClass}
                >
                  {busy ? "Clearing…" : "Clear this summary"}
                </button>
              )}
              {screen.canSendBack && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setActionError("");
                    setDone("");
                    setSendingBack(true);
                  }}
                  className={secondaryClass}
                >
                  Send back to the supervisor
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        <FormSection title="History" note="Every clearance and send-back on this review.">
          {history.length === 0 ? (
            <p className="text-[13px] text-muted">Not checked yet.</p>
          ) : (
            <ul className="grid gap-2">
              {history.map((check, index) => (
                <li
                  key={`${check.at}-${index}`}
                  className="rounded-lg border border-line p-3 text-[13px]"
                >
                  <span className="font-medium text-ink">
                    {ACTION_LABEL[check.action] || check.action}
                  </span>
                  <span className="text-muted">
                    {" "}
                    by {check.officer?.name || "an HR officer"} ·{" "}
                    {formatDateTime(check.at)}
                  </span>
                  {check.reason && (
                    <p className="mt-1 max-w-prose whitespace-pre-wrap text-muted">
                      {check.reason}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FormSection>
      </div>
    </>
  );
}

function Responses({ responses }) {
  if (!responses) {
    return (
      <p className="text-[13px] text-muted">This review has no colleague section.</p>
    );
  }

  if (!responses.released) {
    return (
      <p className="rounded-lg border border-dashed border-line p-4 text-[13px] text-muted">
        {responses.settledCount} of {responses.assignedCount} in. {responses.needed} more
        before anything is shown.
      </p>
    );
  }

  const outstanding = responses.assignedCount - responses.settledCount;

  return (
    <div className="grid gap-3">
      {responses.items.map((item) => (
        <div key={item.id} className="rounded-lg border border-line p-4">
          <p className="text-sm font-medium text-ink">{item.id}&rsquo;s feedback</p>

          <div className="mt-3 grid gap-3">
            <TextAreaField
              id={`${item.id}-strengths`}
              label="One strength worth keeping"
              value={item.freeText?.strengths}
              readOnly
            />
            <TextAreaField
              id={`${item.id}-development`}
              label="One thing that would help them grow"
              value={item.freeText?.development}
              readOnly
            />
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] text-muted hover:text-brand">
              Ratings and evidence
            </summary>
            <div className="mt-3 grid gap-3">
              {(responses.competencies || []).map((competency) => (
                <CompetencyRatingField
                  key={competency.key}
                  competency={competency}
                  value={valueFor(item, competency.key)}
                  readOnly
                />
              ))}
            </div>
          </details>
        </div>
      ))}

      <p className="text-[13px] text-muted">
        {responses.complete
          ? `All ${responses.assignedCount} in.`
          : `${responses.settledCount} of ${responses.assignedCount} in, ${outstanding} to come.`}
      </p>
    </div>
  );
}
