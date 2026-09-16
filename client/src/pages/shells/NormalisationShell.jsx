import { Link, useParams } from "react-router-dom";
import { useTeam } from "../../hooks/useTeam";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";

// ⚠️ Designed and deliberately not built: calibration earns its cost above roughly 100 employees.
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
        to="/normalisation"
        className="mb-6 inline-block text-sm text-muted transition-colors hover:text-brand"
      >
        ← Back to normalisation
      </Link>

      <div className="grid gap-5">
        <FormSection letter="A" title="What the system would compare">
          <Empty>Not built yet.</Empty>
        </FormSection>

        <FormSection
          letter="B"
          title="What it would give back"
          note="A normalised rating per competency, with the reason it moved or held."
        >
          <Empty>Not built yet.</Empty>
        </FormSection>

        <FormSection letter="C" title="Your decision">
          <ul className="grid gap-2 text-sm text-muted">
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

// Disabled, not silent: a live-looking button that discards typing is worse than none.
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
