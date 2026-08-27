import { Link, useParams } from "react-router-dom";
import { useTeam } from "../../hooks/useTeam";
import PageHeader from "../../components/layout/PageHeader";
import ShellNotice from "../../components/shells/ShellNotice";
import { FormSection } from "../../components/shells/FormShell";

// Normalisation: the supervisor starts it, the system runs it, the supervisor checks it.
//
// ⚠️ Designed and deliberately NOT built. Calibration earns its cost above roughly 100
// employees and Altrium has 45, so the recorded position is to design it and decline to
// build it at this scale. The archived walkthrough describes a meeting; that is an early
// draft. See the walkthrough doc, section 3.9.
export default function NormalisationShell() {
  const { id } = useParams();
  const { team } = useTeam();

  const person = (team?.team || []).find((member) => member.id === id);

  return (
    <>
      <PageHeader
        title="Normalisation"
        context={person ? person.name : "The step as it will be"}
      />

      <Link
        to={person ? `/my-team/${person.id}` : "/my-team"}
        className="mb-6 inline-block text-sm text-muted transition-colors hover:text-brand"
      >
        ← Back to {person ? person.name : "my team"}
      </Link>

      <ShellNotice>
        Designed, and deliberately not built. Formal calibration is worth its cost above
        roughly a hundred employees and Altrium has forty-five, so the recorded decision
        is to design it properly and decline to build it at this scale. This screen shows
        where it would sit.
      </ShellNotice>

      <div className="grid gap-5">
        <FormSection
          letter="A"
          title="What the system would compare"
          note="Ratings across teams, so that a lenient supervisor's 4 and a strict one's 4 mean the same thing."
        >
          <Empty>Nothing to compare. No reviews have been submitted, by anybody.</Empty>
        </FormSection>

        <FormSection
          letter="B"
          title="What it would give back"
          note="A normalised rating per competency, each with the reason it moved or the reason it held."
        >
          <Empty>No result, because nothing has been run.</Empty>
          <p className="mt-3 max-w-prose text-[13px] text-muted">
            A rating only ever changes with a written justification, and the distribution
            it compares against is a guide for discussion rather than a quota.
          </p>
        </FormSection>

        <FormSection letter="C" title="Your decision">
          <p className="max-w-prose text-sm text-muted">
            Three ways out of this screen, and the third is the one that matters:
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-muted">
            <li>
              <strong className="text-ink">Confirm</strong>: you are satisfied, and it
              goes to HR.
            </li>
            <li>
              <strong className="text-ink">Intervene</strong>: you disagree, and propose a
              change with your reason.
            </li>
            <li>
              <strong className="text-ink">Escalate</strong>: the system flagged a
              discrepancy you cannot resolve, and HR takes it.
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap gap-3">
            <Dead>Confirm</Dead>
            <Dead>Propose a change</Dead>
            <Dead>Escalate to HR</Dead>
          </div>
        </FormSection>

        <FormSection title="After this">
          <p className="max-w-prose text-sm text-muted">
            HR sees the outcome either way. They resolve anything outstanding, check the
            colleague summary against the raw comments, and publish. What they publish is
            what the employee finally sees: the normalised outcome and consolidated
            themes, never the raw ratings, never who adjusted what, and never a reviewer.
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

function Dead({ children }) {
  return (
    <button
      type="button"
      disabled
      className="cursor-not-allowed rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted opacity-60"
    >
      {children}
    </button>
  );
}
