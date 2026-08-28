import { Link, useParams } from "react-router-dom";
import { useTeam } from "../../hooks/useTeam";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";

// One team member: their self-assessment, their feedback, and the way in to the review.
// Replaced two flat tabs so the supervisor writes once with everything in front of them.
//
// ⚠️ First screen that would serve a feedback record. The shared function stripping
// reviewer identity must land before section B is filled in, plus the three-submission
// threshold, because one comment alone is traceable.
export default function TeamMemberShell() {
  const { id } = useParams();
  const { team, loading, error } = useTeam();

  const person = (team?.team || []).find((member) => member.id === id);
  // ⚠️ THEIR cycle, off the team record, never the signed-in supervisor's. The group
  // comes from each person's joining month, so a team spans groups and a supervisor's
  // own cycle is frequently not the one this person is being appraised in.
  const cycle = person?.cycle || null;

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
        <FormSection
          letter="A"
          title="Their self-assessment"
          note="You cannot start your review until this is submitted, so this section is also the gate."
        >
          <Empty>Not submitted.</Empty>
        </FormSection>

        <FormSection
          letter="B"
          title="Colleague feedback"
          note="Consolidated, and never attributed. You see what was said, not who said it."
        >
          <Empty>No colleague feedback.</Empty>

          <p className="mt-3 max-w-prose text-[13px] text-muted">
            When this fills in, it will never name a reviewer or say how many responded,
            and nothing appears here at all until at least three colleagues have
            submitted.
          </p>
        </FormSection>

        <FormSection
          letter="C"
          title="Your review"
          note="Written once, with everything above in front of you."
        >
          <p className="max-w-prose text-sm text-muted">
            {cycle
              ? `Their ${cycle.parGroup} ${cycle.year} cycle is at ${cycle.status.replace(/_/g, " ")}.`
              : `No cycle is running for the ${person.parGroup || "their"} group.`}{" "}
            A review unlocks once the self-assessment is in and the minimum colleague
            responses have arrived.
          </p>

          <Link
            to={`/my-team/${person.id}/review`}
            className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Supervisor review
          </Link>

          {/* ⚠️ Ungated here so the flow can be walked. The real screen locks it. */}
          <p className="mt-3 max-w-prose text-[13px] text-muted">
            Open in this shell so the flow can be walked. In the real screen it stays
            locked until the conditions above are met.
          </p>
        </FormSection>
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
