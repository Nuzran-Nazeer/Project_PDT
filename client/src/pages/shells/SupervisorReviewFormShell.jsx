import { Link, useParams } from "react-router-dom";
import { useTeam } from "../../hooks/useTeam";
import { useAuth } from "../../hooks/useAuth";
import { jobFamilyFor } from "../../utils/competencies";
import PageHeader from "../../components/layout/PageHeader";
import ShellNotice from "../../components/shells/ShellNotice";
import CompetencyRows from "../../components/shells/CompetencyRows";
import { FormShell, FormSection, FormActions } from "../../components/shells/FormShell";

// The supervisor's review of one person. Third form on the same competencies.
//
// ⚠️ The colleague summary is written by the supervisor, never generated, and HR checks
// it against the raw comments before publication.
// ⚠️ Two supervisors in a cycle means two separate reviews, not one averaged. Not
// handled yet.
export default function SupervisorReviewFormShell() {
  const { id } = useParams();
  const { team } = useTeam();
  const { constants } = useAuth();

  const person = (team?.team || []).find((member) => member.id === id);

  // The reviewee's family, never the supervisor's.
  const revieweeFamily = jobFamilyFor(constants, person?.designation);

  return (
    <>
      <PageHeader
        title="Supervisor review"
        context={
          person
            ? [person.name, person.designation].filter(Boolean).join(" · ")
            : "The form as it will be"
        }
      />

      <Link
        to={person ? `/my-team/${person.id}` : "/my-team"}
        className="mb-6 inline-block text-sm text-muted transition-colors hover:text-brand"
      >
        ← Back to {person ? person.name : "my team"}
      </Link>

      <ShellNotice>
        This is the whole supervisor review form. The person is real; nothing else is.
        There is no self-assessment to compare against and no colleague feedback to
        summarise, so both of those columns are empty rather than filled with examples.
      </ShellNotice>

      <FormShell>
        <FormSection
          letter="A"
          title="Competency ratings"
          note="Your rating beside theirs, with a comment. Where you differ from their own view, the comment is the part that matters."
        >
          <CompetencyRows
            jobFamily={revieweeFamily}
            prompt={(competency) => competency.definition}
          />
        </FormSection>

        <FormSection
          letter="B"
          title="Summary of colleague themes"
          note="Written by you, in your own words, from feedback you can read but cannot attribute."
        >
          <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
            No colleague feedback has been collected, so there is nothing to summarise.
          </p>
          <p className="mt-3 max-w-prose text-[13px] text-muted">
            HR compares this summary against the raw comments before publication. It is
            the one check nobody else in the process can make.
          </p>
        </FormSection>

        <FormSection letter="C" title="Period summary and overall rating">
          <div className="grid gap-3">
            <Prompt>Your summary of this period</Prompt>
            <Prompt>Overall rating, and why</Prompt>
          </div>
        </FormSection>

        <FormSection letter="D" title="Recommendations">
          <div className="grid gap-3">
            <Prompt>Development plan recommended?</Prompt>
            <Prompt>Performance improvement plan recommended?</Prompt>
          </div>
          <p className="mt-3 max-w-prose text-[13px] text-muted">
            Both are recorded here and acted on later. Development plans are not part of
            this release.
          </p>
        </FormSection>

        <FormActions
          backTo={person ? `/my-team/${person.id}` : "/my-team"}
          backLabel="Back without submitting"
        />
      </FormShell>

      <p className="mt-4 max-w-prose text-[13px] text-muted">
        Once submitted, the next step is normalisation, which you start, the system runs,
        and you then check.
      </p>

      {person && (
        <Link
          to={`/my-team/${person.id}/normalisation`}
          className="mt-3 inline-block rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand"
        >
          Continue to normalisation
        </Link>
      )}
    </>
  );
}

function Prompt({ children }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink">{children}</p>
      <div className="mt-1.5 rounded-lg border border-dashed border-line px-3.5 py-3 text-[13px] text-muted">
        Written answer
      </div>
    </div>
  );
}
