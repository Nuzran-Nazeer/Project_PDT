import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTeam } from "../../hooks/useTeam";
import { getCollected, getTeamMemberAssessment } from "../../services/feedback";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";
import CollectedFeedback from "../../components/forms/CollectedFeedback";
import ResponseCard from "../../components/forms/ResponseCard";
import { summariseRatings } from "../../utils/ratingSummary";

// A submitted review stays reachable: the form serves it read-only once its window has closed.
const REVIEW_LINK = {
  ready: "Supervisor review",
  draft: "Continue your review",
  submitted: "View your review",
  awaiting_normalisation: "View your review",
  normalisation_ready: "View your review",
};

export default function TeamMemberPage() {
  const { id } = useParams();
  const { team, loading, error } = useTeam();

  const person = (team?.team || []).find((member) => member.id === id);
  // ⚠️ Their cycle, off the team record, never the signed-in supervisor's: a team spans groups.
  const cycle = person?.cycle || null;
  const reviewId = person?.reviewId || null;

  const [collected, setCollected] = useState(null);
  const [collectedError, setCollectedError] = useState("");
  const [assessment, setAssessment] = useState(null);
  const [assessmentError, setAssessmentError] = useState("");

  useEffect(() => {
    if (!reviewId) return undefined;

    let cancelled = false;

    getCollected(reviewId)
      .then((data) => !cancelled && setCollected(data))
      .catch((err) => !cancelled && setCollectedError(err.message));

    getTeamMemberAssessment(reviewId)
      .then((data) => !cancelled && setAssessment(data))
      .catch((err) => !cancelled && setAssessmentError(err.message));

    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const readiness = person?.readiness || null;
  const waitingFor = readiness
    ? [
        readiness.missing.selfAssessment && "their self-assessment",
        readiness.missing.colleagues &&
          `${readiness.missing.colleagues} colleague ${
            readiness.missing.colleagues === 1 ? "response" : "responses"
          }`,
      ].filter(Boolean)
    : [];

  if (loading) {
    return (
      <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
        Loading…
      </p>
    );
  }

  if (error || !person) {
    return (
      <>
        <PageHeader title="Team member" backTo="/my-team" />
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error || "That person is not in the team you lead today."}
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={person.name}
        context={[person.designation, person.unit?.name, person.employeeId]
          .filter(Boolean)
          .join(" · ")}
      />

      <Link
        to="/my-team"
        className="mb-6 inline-block text-sm text-muted transition-colors hover:text-brand"
      >
        ← Back to my team
      </Link>

      <div className="grid gap-5">
        <FormSection letter="A" title="Their self-assessment">
          {assessmentError ? (
            <p role="alert" className="text-[13px] text-danger">
              {assessmentError}
            </p>
          ) : !reviewId ? (
            <Empty>No review exists for this person yet.</Empty>
          ) : !assessment ? (
            <Empty>Loading…</Empty>
          ) : assessment.available ? (
            <ResponseCard
              to={`/my-team/${person.id}/self-assessment`}
              title="Their self-assessment"
              summary={summariseRatings(assessment.ratings)}
            />
          ) : (
            <Empty>
              {assessment.reason === "in_window"
                ? "Submitted. Opens once their five-hour correction window closes."
                : "Not submitted yet."}
            </Empty>
          )}
        </FormSection>

        <FormSection
          letter="B"
          title="Colleague feedback"
          note="Colleagues are never named."
        >
          {collectedError ? (
            <p role="alert" className="text-[13px] text-danger">
              {collectedError}
            </p>
          ) : !reviewId ? (
            <Empty>No review exists for this person yet.</Empty>
          ) : !collected ? (
            <Empty>Loading…</Empty>
          ) : (
            <CollectedFeedback collected={collected} personId={person.id} />
          )}
        </FormSection>

        <FormSection letter="C" title="Your review">
          <p className="max-w-prose text-sm text-muted">
            {cycle
              ? `Their ${cycle.parGroup} ${cycle.year} cycle is at ${cycle.status.replace(/_/g, " ")}.`
              : `No cycle is running for the ${person.parGroup || "their"} group.`}
          </p>

          {person.sentBack && (
            <p className="mt-3 max-w-prose text-[13px] font-medium text-amber-700 dark:text-amber-400">
              HR sent your colleague summary back. The reason is at the top of the form.
            </p>
          )}

          {/* Hides the way in, never protects it: the server refuses the form with a 409. */}
          {readiness && readiness.state !== "waiting" ? (
            <Link
              to={`/my-team/${person.id}/review`}
              className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {person.sentBack
                ? "Revise your review"
                : REVIEW_LINK[readiness.state] || "Supervisor review"}
            </Link>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-[13px] text-muted">
              {waitingFor.length
                ? `Waiting for ${waitingFor.join(" and ")}.`
                : "Waiting: there is no review to write against yet."}
            </p>
          )}
        </FormSection>

        {/* A published review is where a development plan starts, so the way in is here. */}
        {person.result && (
          <FormSection
            letter="D"
            title="Development plan"
            note="Actions for the year ahead, each tied to a competency the review highlighted."
          >
            <Link
              to="/team-plans"
              className="inline-block rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-brand transition-colors hover:bg-surface"
            >
              Go to team plans
            </Link>
          </FormSection>
        )}
      </div>
    </>
  );
}

function Empty({ children }) {
  return (
    <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}
