import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { acknowledgeMyResult, getMyResult } from "../../services/reviews";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import { FormShell, FormSection } from "../../components/shells/FormShell";

// ⚠️ Three things never reach this page: a reviewer, how many responded, and any score.
// The colleague part is the supervisor's written summary and nothing else.

const primaryClass =
  "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass =
  "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";

// No reason is given for a withdrawal, here or anywhere the employee can reach.
const NOTHING_PUBLISHED = {
  none: "No result has been published for you yet.",
  withdrawn: "No result was published for you this cycle.",
};

function Written({ label, value }) {
  return (
    <div className="border-t border-line pt-4 first:border-0 first:pt-0">
      <h3 className="text-sm font-medium text-ink">{label}</h3>
      <p className="mt-1.5 max-w-prose whitespace-pre-line text-sm text-muted">
        {value || "Nothing was written."}
      </p>
    </div>
  );
}

export default function MyResultPage() {
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getMyResult()
      .then((data) => !cancelled && setResult(data))
      .catch((err) => !cancelled && setLoadError(err.message));

    return () => {
      cancelled = true;
    };
  }, []);

  const onAcknowledge = async () => {
    setBusy(true);
    setActionError("");
    try {
      setResult(await acknowledgeMyResult());
      setConfirming(false);
    } catch (err) {
      setActionError(err.message);
      // The result may have moved under this page; the server's answer replaces it.
      if (err.status === 409) {
        getMyResult()
          .then(setResult)
          .catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <>
        <PageHeader title="My result" backTo="/dashboard" />
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {loadError}
        </p>
      </>
    );
  }

  if (!result) {
    return (
      <>
        <PageHeader title="My result" backTo="/dashboard" />
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      </>
    );
  }

  if (result.state !== "published") {
    return (
      <>
        <PageHeader title="My result" backTo="/dashboard" />
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          {NOTHING_PUBLISHED[result.state] || NOTHING_PUBLISHED.none}
        </p>
      </>
    );
  }

  const { cycle, supervisor, supervisorReview, colleagueSummary } = result;
  const ratingFor = (key) =>
    (supervisorReview.ratings || []).find((row) => row.competencyKey === key);

  return (
    <>
      <PageHeader
        title="My result"
        context={[
          cycle && `${cycle.parGroup} ${cycle.year}`,
          `Published ${formatDate(result.publishedAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        backTo="/dashboard"
      />

      <FormShell>
        <FormSection
          letter="A"
          title="Your supervisor's review"
          note={
            supervisor ? `Written by ${supervisor.name}.` : "Written by your supervisor."
          }
        >
          <div className="grid gap-4">
            {(supervisorReview.competencies || []).map((competency) => {
              const rating = ratingFor(competency.key);
              return (
                <Written
                  key={competency.key}
                  label={competency.name}
                  value={rating?.notObserved ? "Not observed." : rating?.evidence}
                />
              );
            })}

            <Written
              label="Your strengths this cycle"
              value={supervisorReview.freeText?.strengths}
            />
            <Written
              label="Where you should develop next"
              value={supervisorReview.freeText?.development}
            />
          </div>
        </FormSection>

        <FormSection letter="B" title="What colleagues said">
          {colleagueSummary.present ? (
            <p className="max-w-prose whitespace-pre-line text-sm text-muted">
              {colleagueSummary.text || "Nothing was written."}
            </p>
          ) : (
            <p className="max-w-prose text-sm text-muted">{colleagueSummary.note}</p>
          )}
        </FormSection>

        <FormSection
          letter="C"
          title="Your self-assessment"
          note="What you wrote at the start of this cycle, on its own page."
        >
          <Link
            to="/my-self-assessment"
            className="text-sm font-medium text-brand transition-colors hover:underline"
          >
            Open your self-assessment
          </Link>
        </FormSection>

        <FormSection letter="D" title="Acknowledge this result">
          {result.acknowledgedAt ? (
            <p className="max-w-prose text-sm text-muted">
              You acknowledged this result on {formatDate(result.acknowledgedAt)}.
            </p>
          ) : (
            <>
              <p className="max-w-prose text-sm text-muted">
                Records that you read this, not that you agree. It cannot be undone.
              </p>

              {actionError && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {actionError}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {confirming ? (
                  <>
                    <button
                      type="button"
                      className={primaryClass}
                      disabled={busy}
                      onClick={onAcknowledge}
                    >
                      {busy ? "Recording…" : "Yes, I have read it"}
                    </button>
                    <button
                      type="button"
                      className={secondaryClass}
                      disabled={busy}
                      onClick={() => setConfirming(false)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={primaryClass}
                    disabled={!result.canAcknowledge}
                    onClick={() => setConfirming(true)}
                  >
                    Acknowledge this result
                  </button>
                )}
              </div>
            </>
          )}
        </FormSection>
      </FormShell>
    </>
  );
}
