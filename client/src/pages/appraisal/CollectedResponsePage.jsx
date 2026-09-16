import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTeam } from "../../hooks/useTeam";
import { getCollected } from "../../services/feedback";
import PageHeader from "../../components/layout/PageHeader";
import { FormShell, FormSection } from "../../components/shells/FormShell";
import CompetencyRatingField from "../../components/forms/CompetencyRatingField";
import TextAreaField from "../../components/forms/TextAreaField";

// ⚠️ The label in the URL is the only handle there is: the real id never leaves the server.

const valueFor = (item, key) => {
  const rating = (item.ratings || []).find((r) => r.competencyKey === key);
  return {
    score: rating?.score ?? null,
    evidence: rating?.evidence ?? "",
    notObserved: rating?.notObserved ?? false,
  };
};

export default function CollectedResponsePage() {
  const { id, label } = useParams();
  const { team, loading: teamLoading, error: teamError } = useTeam();

  const person = (team?.team || []).find((member) => member.id === id);
  const reviewId = person?.reviewId || null;

  const [collected, setCollected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reviewId) return undefined;

    let cancelled = false;

    getCollected(reviewId)
      .then((data) => !cancelled && setCollected(data))
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
        <PageHeader title="Colleague feedback" backTo={backTo} />
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {problem}
        </p>
      </>
    );
  }

  if (!collected) {
    return (
      <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
        Loading…
      </p>
    );
  }

  const item = collected.released
    ? (collected.items || []).find((one) => one.id === label)
    : null;

  if (!item) {
    return (
      <>
        <PageHeader title="Colleague feedback" backTo={backTo} />
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          {collected.released
            ? "That response is not in the released batch."
            : "Nothing is released yet."}
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`${item.id}'s feedback`} context={person.name} backTo={backTo} />

      <FormShell>
        <FormSection letter="A" title="Competency ratings" note="As they answered them.">
          <div className="grid gap-4">
            {(collected.competencies || []).map((competency) => (
              <CompetencyRatingField
                key={competency.key}
                competency={competency}
                value={valueFor(item, competency.key)}
                readOnly
              />
            ))}
          </div>
        </FormSection>

        <FormSection letter="B" title="In their own words">
          <div className="grid gap-3">
            <TextAreaField
              id="strengths"
              label="One strength worth keeping"
              value={item.freeText?.strengths}
              readOnly
            />
            <TextAreaField
              id="development"
              label="One thing that would help them grow"
              value={item.freeText?.development}
              readOnly
            />
          </div>
        </FormSection>
      </FormShell>
    </>
  );
}
