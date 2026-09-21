import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTeam } from "../../hooks/useTeam";
import {
  getSupervisorReview,
  saveSupervisorDraft,
  submitSupervisorReview,
} from "../../services/feedback";
import { buildPeerReviewSchema } from "../../schemas/peerReviewSchema";
import PageHeader from "../../components/layout/PageHeader";
import { FormShell, FormSection } from "../../components/shells/FormShell";
import CompetencyRatingField from "../../components/forms/CompetencyRatingField";
import TextAreaField from "../../components/forms/TextAreaField";
import EditWindowNotice from "../../components/forms/EditWindowNotice";
import { formatDate } from "../../utils/dates";

// Keyed by competencyKey; turned into the server's array only when saving or submitting.
const answersFrom = (competencies, existingRatings) => {
  const byKey = Object.fromEntries(
    (existingRatings || []).map((r) => [r.competencyKey, r]),
  );
  return Object.fromEntries(
    competencies.map((c) => [
      c.key,
      {
        score: byKey[c.key]?.score ?? null,
        evidence: byKey[c.key]?.evidence ?? "",
        notObserved: byKey[c.key]?.notObserved ?? false,
      },
    ]),
  );
};

// ⚠️ Only answered rows are sent: the server validates every row in the array, so a
// placeholder row makes a draft fail like a submit.
const isAnswered = (row) => row.notObserved || row.score !== null;

const ratingsArrayFrom = (answers) =>
  Object.entries(answers)
    .filter(([, row]) => isAnswered(row))
    .map(([competencyKey, row]) => ({
      competencyKey,
      notObserved: row.notObserved,
      score: row.notObserved ? null : row.score,
      evidence: row.notObserved ? null : row.evidence || null,
    }));

const STATUS_LABEL = {
  not_started: "Not started",
  assigned: "Not started",
  draft: "Draft saved",
  submitted: "Submitted",
  locked: "Submitted",
};

// ⚠️ The colleague summary is written by hand; nothing generates it. Two supervisors in
// one cycle is not handled: every record is written against period 0.
export default function SupervisorReviewFormPage() {
  const { id } = useParams();
  const { team, loading: teamLoading } = useTeam();

  const person = (team?.team || []).find((member) => member.id === id);
  const whose = person ? `${person.name}'s` : "the employee's";
  const reviewId = person?.reviewId || null;

  const [record, setRecord] = useState(null);
  const [loadError, setLoadError] = useState("");
  // Not ready is a state, not a failure.
  const [notReady, setNotReady] = useState("");

  // ⚠️ Derived, never a flag set in the effect: somebody with no review to fetch would load for ever.
  const loading = teamLoading || Boolean(reviewId && !record && !loadError && !notReady);

  const [answers, setAnswers] = useState({});
  const [strengths, setStrengths] = useState("");
  const [development, setDevelopment] = useState("");
  const [colleagueSummary, setColleagueSummary] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const applyRecord = (data) => {
    setRecord(data);
    setAnswers(answersFrom(data.competencies || [], data.ratings));
    setStrengths(data.freeText?.strengths || "");
    setDevelopment(data.freeText?.development || "");
    setColleagueSummary(data.colleagueSummary || "");
  };

  useEffect(() => {
    if (!reviewId) return undefined;

    let cancelled = false;

    getSupervisorReview(reviewId)
      .then((data) => !cancelled && applyRecord(data))
      .catch((err) => {
        if (cancelled) return;
        // The readiness gate answers 409.
        if (err.status === 409) setNotReady(err.message);
        else setLoadError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const setRow = (competencyKey, patch) => {
    setSuccessMessage("");
    setAnswers((prev) => ({
      ...prev,
      [competencyKey]: { ...prev[competencyKey], ...patch },
    }));
  };

  const payload = () => ({
    ratings: ratingsArrayFrom(answers),
    freeText: { strengths: strengths || null, development: development || null },
    colleagueSummary: colleagueSummary || null,
  });

  const runSave = async (action, body, savedMessage) => {
    setFormError("");
    setFieldErrors({});
    setSuccessMessage("");
    setSaving(true);
    try {
      applyRecord(await action(reviewId, body));
      setSuccessMessage(savedMessage);
    } catch (err) {
      setFormError(err.message);
      // ⚠️ The window can close while this page sits open; the server's refusal flips the screen.
      if (err.status === 409) {
        getSupervisorReview(reviewId)
          .then(applyRecord)
          .catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  };

  const onSaveDraft = () => runSave(saveSupervisorDraft, payload(), "Draft saved.");

  // ⚠️ Yup's `ratings[2]` indexes the array sent, not the full competency list.
  const errorsByCompetency = (validationError, sent) => {
    const errors = {};
    validationError.inner.forEach((err) => {
      const at = err.path?.match(/^ratings\[(\d+)\]/);
      const key = at && sent[Number(at[1])]?.competencyKey;
      if (key && !errors[key]) errors[key] = err.message;
    });
    return errors;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    const body = payload();
    try {
      await buildPeerReviewSchema(record.competencies).validate(body, {
        abortEarly: false,
      });
    } catch (validationError) {
      setFieldErrors(errorsByCompetency(validationError, body.ratings));
      setFormError("Answer every competency before submitting.");
      return;
    }

    await runSave(submitSupervisorReview, body, "Submitted.");
  };

  const backTo = person ? `/my-team/${person.id}` : "/my-team";

  if (loading) {
    return (
      <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
        Loading…
      </p>
    );
  }

  const header = (
    <>
      <PageHeader
        title="Supervisor review"
        context={
          person ? [person.name, person.designation].filter(Boolean).join(" · ") : null
        }
      />

      <Link
        to={backTo}
        className="mb-6 inline-block text-sm text-muted transition-colors hover:text-brand"
      >
        ← Back to {person ? person.name : "my team"}
      </Link>
    </>
  );

  if (!reviewId) {
    return (
      <>
        {header}
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          {person
            ? `No review exists for ${person.name} yet.`
            : "That person is not in the team you lead today."}
        </p>
      </>
    );
  }

  if (notReady) {
    return (
      <>
        {header}
        <div className="rounded-xl border border-dashed border-line bg-raised p-5">
          <p className="text-sm text-ink">Not ready to start</p>
          <p className="mt-2 max-w-prose text-[13px] text-muted">{notReady}</p>
        </div>
      </>
    );
  }

  if (loadError || !record) {
    return (
      <>
        {header}
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {loadError || "That review could not be loaded."}
        </p>
      </>
    );
  }

  const editable = record.editable;

  // Closed means no controls, not disabled controls.
  const body = (
    <FormShell>
      <FormSection
        letter="A"
        title="Competency ratings"
        note={editable ? "Every rating needs written evidence." : "As you answered them."}
      >
        <div className="grid gap-4">
          {(record.competencies || []).map((competency) => (
            <CompetencyRatingField
              key={competency.key}
              competency={competency}
              value={answers[competency.key]}
              onChange={(patch) => setRow(competency.key, patch)}
              readOnly={!editable}
              error={fieldErrors[competency.key]}
            />
          ))}
        </div>
      </FormSection>

      <FormSection
        letter="B"
        title="Summary of colleague feedback"
        note="This is the only part of the colleague feedback the employee sees."
      >
        <TextAreaField
          id="colleagueSummary"
          label="Your summary of what colleagues said"
          value={colleagueSummary}
          onChange={(value) => {
            setSuccessMessage("");
            setColleagueSummary(value);
          }}
          readOnly={!editable}
        />
      </FormSection>

      <FormSection letter="C" title="Cycle summary">
        <div className="grid gap-3">
          {editable ? (
            <>
              <TextAreaField
                id="strengths"
                label="Their strengths this cycle"
                value={strengths}
                onChange={(value) => {
                  setSuccessMessage("");
                  setStrengths(value);
                }}
              />
              <TextAreaField
                id="development"
                label="Where they should develop next"
                value={development}
                onChange={(value) => {
                  setSuccessMessage("");
                  setDevelopment(value);
                }}
              />
            </>
          ) : (
            <>
              <Written label="Their strengths this cycle" value={strengths} />
              <Written label="Where they should develop next" value={development} />
            </>
          )}
        </div>
      </FormSection>

      <FormSection letter="D" title="Recommendations">
        <NotYet>
          Development plans and performance improvement plans are not built yet.
        </NotYet>
      </FormSection>

      {editable && (
        <div className="rounded-xl border border-line p-5">
          {successMessage && (
            <p className="mb-3 text-[13px] text-success">{successMessage}</p>
          )}

          {formError && (
            <p role="alert" className="mt-1.5 text-[13px] text-danger">
              {formError}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-3">
            {/* Not a submit: a draft may be incomplete and must never reach the schema. */}
            <button
              type="button"
              disabled={saving}
              onClick={onSaveDraft}
              className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save as draft"}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Submitting…" : record.submittedAt ? "Update" : "Submit"}
            </button>
          </div>

          <p className="mt-3 max-w-prose text-[13px] text-muted">
            Correctable for <strong>five hours</strong> after submitting.
          </p>
        </div>
      )}
    </FormShell>
  );

  return (
    <>
      {header}

      <p className="-mt-6 mb-6 text-[13px] text-muted">
        Status:{" "}
        <span className="text-ink">{STATUS_LABEL[record.status] || record.status}</span>
      </p>

      {record.sentBack && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-[13px]"
        >
          <p className="font-semibold text-ink">
            Sent back by {record.sentBack.officer?.name || "HR"} on{" "}
            {formatDate(record.sentBack.at)}.
          </p>
          <p className="mt-1 max-w-prose whitespace-pre-wrap text-ink">
            {record.sentBack.reason}
          </p>
          <p className="mt-2 max-w-prose text-muted">
            Your whole review is open again. Revise the summary, then submit it again.
          </p>
        </div>
      )}

      {record.publishedAt ? (
        <div
          role="status"
          className="mb-6 rounded-xl border border-line bg-raised p-4 text-[13px]"
        >
          <p className="font-semibold text-ink">
            Published {formatDate(record.publishedAt)}.
          </p>
          <p className="mt-1 max-w-prose text-muted">
            This is now part of {whose} record and cannot be changed.
          </p>
        </div>
      ) : (
        record.submittedAt && (
          <div className="mb-6">
            <EditWindowNotice
              submittedAt={record.submittedAt}
              locksAt={record.locksAt}
              editable={editable}
            />
          </div>
        )
      )}

      {editable ? (
        <form onSubmit={onSubmit} noValidate>
          {body}
        </form>
      ) : (
        body
      )}
    </>
  );
}

function Written({ label, value }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <p className="font-medium text-ink">{label}</p>
      <p className="mt-2 max-w-prose whitespace-pre-wrap text-[13px] text-muted">
        {value || "Nothing written."}
      </p>
    </div>
  );
}

function NotYet({ children }) {
  return (
    <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-[13px] text-muted">
      {children}
    </p>
  );
}
