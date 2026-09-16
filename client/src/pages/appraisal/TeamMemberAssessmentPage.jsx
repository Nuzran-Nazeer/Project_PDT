import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTeam } from "../../hooks/useTeam";
import { getTeamMemberAssessment } from "../../services/feedback";
import PageHeader from "../../components/layout/PageHeader";
import { FormShell, FormSection } from "../../components/shells/FormShell";
import CompetencyRatingField from "../../components/forms/CompetencyRatingField";
import TextAreaField from "../../components/forms/TextAreaField";

const valueFor = (assessment, key) => {
  const rating = (assessment.ratings || []).find((r) => r.competencyKey === key);
  return {
    score: rating?.score ?? null,
    evidence: rating?.evidence ?? "",
    notObserved: rating?.notObserved ?? false,
  };
};

export default function TeamMemberAssessmentPage() {
  const { id } = useParams();
  const { team, loading: teamLoading, error: teamError } = useTeam();

  const person = (team?.team || []).find((member) => member.id === id);
  const reviewId = person?.reviewId || null;

  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reviewId) return undefined;

    let cancelled = false;

    getTeamMemberAssessment(reviewId)
      .then((data) => !cancelled && setAssessment(data))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  if (teamLoading) {
    return (
      <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
        Loading…
      </p>
    );
  }

  const backTo = person ? `/my-team/${id}` : "/my-team";
  const problem =
    teamError ||
    (!person && "That person is not in the team you lead today.") ||
    error ||
    (!reviewId && "No review exists for this person yet.");

  if (problem) {
    return (
      <>
        <PageHeader title="Self-assessment" backTo={backTo} />
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {problem}
        </p>
      </>
    );
  }

  if (!assessment) {
    return (
      <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
        Loading…
      </p>
    );
  }

  // Two absences: waiting on the author, or on a clock that has already started.
  if (!assessment.available) {
    return (
      <>
        <PageHeader title="Self-assessment" context={person.name} backTo={backTo} />
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          {assessment.reason === "in_window"
            ? "Submitted. Opens once their five-hour correction window closes."
            : "Not submitted yet."}
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Their self-assessment" context={person.name} backTo={backTo} />

      <FormShell>
        <FormSection letter="A" title="Competency ratings" note="As they answered them.">
          <div className="grid gap-4">
            {(assessment.competencies || []).map((competency) => (
              <CompetencyRatingField
                key={competency.key}
                competency={competency}
                value={valueFor(assessment, competency.key)}
                readOnly
              />
            ))}
          </div>
        </FormSection>

        <FormSection letter="B" title="In their own words">
          <div className="grid gap-3">
            <TextAreaField
              id="strengths"
              label="Their biggest achievement this cycle"
              value={assessment.freeText?.strengths}
              readOnly
            />
            <TextAreaField
              id="development"
              label="What would help them most next cycle"
              value={assessment.freeText?.development}
              readOnly
            />
          </div>
        </FormSection>
      </FormShell>
    </>
  );
}
