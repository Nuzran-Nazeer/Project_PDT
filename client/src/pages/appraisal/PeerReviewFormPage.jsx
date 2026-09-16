import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getOwed, saveDraft, submitFeedback } from "../../services/feedback";
import { buildPeerReviewSchema } from "../../schemas/peerReviewSchema";
import PageHeader from "../../components/layout/PageHeader";
import { FormShell, FormSection } from "../../components/shells/FormShell";
import CompetencyRatingField from "../../components/forms/CompetencyRatingField";
import TextAreaField from "../../components/forms/TextAreaField";
import EditWindowNotice from "../../components/forms/EditWindowNotice";

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
  assigned: "Not started",
  draft: "Draft saved",
  submitted: "Submitted",
  locked: "Submitted",
};

// The competencies come from the reviewee's job family, read off the record.
// ⚠️ Anonymity runs one way: the reviewer sees who they review, never the reverse.
export default function PeerReviewFormPage() {
  const { id } = useParams();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [answers, setAnswers] = useState({});
  const [strengths, setStrengths] = useState("");
  const [development, setDevelopment] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const applyRecord = (data) => {
    setRecord(data);
    setAnswers(answersFrom(data.competencies, data.ratings));
    setStrengths(data.freeText?.strengths || "");
    setDevelopment(data.freeText?.development || "");
  };

  useEffect(() => {
    let cancelled = false;

    getOwed(id)
      .then((data) => !cancelled && applyRecord(data))
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [id]);

  const setRow = (competencyKey, patch) => {
    setSuccessMessage("");
    setAnswers((prev) => ({
      ...prev,
      [competencyKey]: { ...prev[competencyKey], ...patch },
    }));
  };

  const onStrengthsChange = (value) => {
    setSuccessMessage("");
    setStrengths(value);
  };

  const onDevelopmentChange = (value) => {
    setSuccessMessage("");
    setDevelopment(value);
  };

  const payload = () => ({
    ratings: ratingsArrayFrom(answers),
    freeText: { strengths: strengths || null, development: development || null },
  });

  const runSave = async (action, body, savedMessage) => {
    setFormError("");
    setFieldErrors({});
    setSuccessMessage("");
    setSaving(true);
    try {
      applyRecord(await action(id, body));
      setSuccessMessage(savedMessage);
    } catch (err) {
      setFormError(err.message);
      // ⚠️ The window can close while this page sits open; the server's refusal flips the screen.
      if (err.status === 409) {
        getOwed(id)
          .then(applyRecord)
          .catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  };

  const onSaveDraft = () => runSave(saveDraft, payload(), "Draft saved.");

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

    await runSave(submitFeedback, body, "Submitted.");
  };

  if (loading) {
    return (
      <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
        Loading…
      </p>
    );
  }

  if (loadError || !record) {
    return (
      <>
        <PageHeader title="Colleague feedback" backTo="/feedback-i-owe" />
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {loadError || "That review could not be found."}
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
        note={
          editable
            ? "The same competencies their supervisor rates, asked of you as a colleague. Decline any you have not seen: that is a real answer, not a gap."
            : "As you answered them."
        }
      >
        <div className="grid gap-4">
          {record.competencies.map((competency) => (
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

      <FormSection letter="B" title="In your own words">
        <div className="grid gap-3">
          <TextAreaField
            id="strengths"
            label="One strength worth keeping"
            value={strengths}
            onChange={onStrengthsChange}
            readOnly={!editable}
          />
          <TextAreaField
            id="development"
            label="One thing that would help them grow"
            value={development}
            onChange={onDevelopmentChange}
            readOnly={!editable}
          />
        </div>
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
              {saving
                ? "Submitting…"
                : record.status === "submitted"
                  ? "Update"
                  : "Submit"}
            </button>
          </div>

          <p className="mt-3 max-w-prose text-[13px] text-muted">
            A draft stays private to you. A submitted form can still be corrected for{" "}
            <strong>five hours</strong> before it locks.
          </p>
        </div>
      )}
    </FormShell>
  );

  return (
    <>
      <PageHeader
        title="Colleague feedback"
        context={`${record.reviewee.name} · ${record.reviewee.designation || ""}`}
        backTo="/dashboard"
      />

      <p className="-mt-6 mb-6 text-[13px] text-muted">
        Status:{" "}
        <span className="text-ink">{STATUS_LABEL[record.status] || record.status}</span>
      </p>

      {record.submittedAt && (
        <div className="mb-6">
          <EditWindowNotice
            submittedAt={record.submittedAt}
            locksAt={record.locksAt}
            editable={editable}
          />
        </div>
      )}

      {editable ? (
        <form onSubmit={onSubmit} noValidate>
          {body}
        </form>
      ) : (
        body
      )}

      <p className="mt-4 max-w-prose text-[13px] text-muted">
        {editable ? "What you write" : "What you wrote"} reaches their supervisor as part
        of a consolidated summary, never with your name on it.
      </p>
    </>
  );
}
