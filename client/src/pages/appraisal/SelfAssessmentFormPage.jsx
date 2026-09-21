import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useReportingLine } from "../../hooks/useReportingLine";
import {
  getSelfAssessment,
  saveSelfDraft,
  submitSelfAssessment,
} from "../../services/feedback";
import { buildPeerReviewSchema } from "../../schemas/peerReviewSchema";
import { formatDate } from "../../utils/dates";
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
  not_started: "Not started",
  assigned: "Not started",
  draft: "Draft saved",
  submitted: "Submitted",
  locked: "Submitted",
};

export default function SelfAssessmentFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { line } = useReportingLine();

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
    setAnswers(answersFrom(data.competencies || [], data.ratings));
    setStrengths(data.freeText?.strengths || "");
    setDevelopment(data.freeText?.development || "");
  };

  useEffect(() => {
    let cancelled = false;

    getSelfAssessment()
      .then((data) => !cancelled && applyRecord(data))
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

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
  });

  const runSave = async (action, body, savedMessage) => {
    setFormError("");
    setFieldErrors({});
    setSuccessMessage("");
    setSaving(true);
    try {
      applyRecord(await action(body));
      setSuccessMessage(savedMessage);
      return true;
    } catch (err) {
      setFormError(err.message);
      // ⚠️ The window can close while this page sits open; the server's refusal flips the screen.
      if (err.status === 409) {
        getSelfAssessment()
          .then(applyRecord)
          .catch(() => {});
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onSaveDraft = () => runSave(saveSelfDraft, payload(), "Draft saved.");

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

    // Submitting leaves the form; a draft stays put.
    if (await runSave(submitSelfAssessment, body, "Submitted.")) {
      navigate("/my-self-assessment");
    }
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
        <PageHeader title="My self-assessment" backTo="/my-self-assessment" />
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {loadError || "Your self-assessment could not be loaded."}
        </p>
      </>
    );
  }

  const cycle = record.cycle;

  if (!cycle || !record.reviewId) {
    return (
      <>
        <PageHeader title="My self-assessment" backTo="/my-self-assessment" />
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          {cycle
            ? `The ${cycle.parGroup} ${cycle.year} cycle is running, but you have no review in it.`
            : "No cycle is running for your group."}
        </p>
      </>
    );
  }

  const editable = record.editable;
  const supervisor = line?.supervisor;

  // Closed means no controls, not disabled controls.
  const body = (
    <FormShell>
      <FormSection
        letter="A"
        title="Cycle context"
        note="Read-only, filled by the system."
      >
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Fact label="Employee ID" value={user?.employeeId} />
          <Fact label="Designation" value={user?.designation} />
          <Fact label="Job family" value={user?.jobFamily} />
          <Fact label="Appraisal group" value={user?.parGroup} />
          <Fact label="Joined" value={formatDate(user?.joinedDate)} />
          <Fact label="Cycle" value={`${cycle.parGroup} ${cycle.year}`} />
          {/* ⚠️ One supervisor shown, and there can be two. Becomes a list of periods. */}
          <Fact label="Supervisor this cycle" value={supervisor?.name || "None"} />
        </dl>
      </FormSection>

      <FormSection
        letter="B"
        title="Progress against last cycle's goals"
        note="Each goal from your last development plan, with what happened to it."
      >
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
          Not built yet.
        </p>
      </FormSection>

      <FormSection
        letter="C"
        title="Competency self-rating"
        note={
          editable
            ? "A rating from 1 to 5. Every rating needs written evidence."
            : "As you answered them."
        }
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

      <FormSection letter="D" title="Reflection">
        <div className="grid gap-3">
          <TextAreaField
            id="strengths"
            label="Biggest achievement this cycle"
            value={strengths}
            onChange={(value) => {
              setSuccessMessage("");
              setStrengths(value);
            }}
            readOnly={!editable}
          />
          <TextAreaField
            id="development"
            label="What would help you most next cycle"
            value={development}
            onChange={(value) => {
              setSuccessMessage("");
              setDevelopment(value);
            }}
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
      <PageHeader
        title="My self-assessment"
        context={`${cycle.parGroup} group · ${cycle.year}`}
        backTo="/my-self-assessment"
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
    </>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || "Not recorded"}</dd>
    </div>
  );
}
