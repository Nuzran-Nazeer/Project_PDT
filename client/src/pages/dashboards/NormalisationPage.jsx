import { Link } from "react-router-dom";
import { useTeam } from "../../hooks/useTeam";
import PageHeader from "../../components/layout/PageHeader";
import { byRunningCycle } from "../../utils/teamOrder";

// ⚠️ Opens per appraisal group, and a team spans groups, so the gate is each person's
// own cycle reaching its normalising stage. Two rows can differ with identical reviews.
const ROW_STATE = {
  normalisation_ready: { label: "Ready", open: true },
  awaiting_normalisation: { label: "Waiting for their cycle to reach normalising" },
  submitted: { label: "Your review is still inside its correction window" },
  draft: { label: "Your review is saved as a draft, not submitted" },
  ready: { label: "Your review has not been started" },
  waiting: { label: "Their feedback is still coming in" },
};

export default function NormalisationPage() {
  const { team, loading, error } = useTeam();

  const people = byRunningCycle(team?.team || []);

  return (
    <>
      <PageHeader title="Normalisation" backTo="/dashboard" />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      ) : loading ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      ) : people.length === 0 ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Nobody reports to you at the moment.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <Th>Name</Th>
                <Th>Their cycle</Th>
                <Th>State</Th>
                <Th>Normalisation</Th>
              </tr>
            </thead>

            <tbody>
              {people.map((person) => (
                <Row key={person.id} person={person} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Row({ person }) {
  const state = person.readiness ? ROW_STATE[person.readiness.state] : null;

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3 font-medium text-ink">{person.name}</td>
      <td className="px-4 py-3 text-muted">
        {person.cycle
          ? `${person.cycle.parGroup} ${person.cycle.year} · ${person.cycle.status.replace(/_/g, " ")}`
          : "No cycle running"}
      </td>
      <td className="px-4 py-3">
        {state?.open ? (
          <span className="font-medium text-success">{state.label}</span>
        ) : (
          <span className="text-muted">
            {state?.label || "No review exists for them yet"}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {state?.open ? (
          <Link
            to={`/my-team/${person.id}/normalisation`}
            className="text-sm text-brand transition-colors hover:underline"
          >
            Open
          </Link>
        ) : (
          <span className="text-muted">Not yet</span>
        )}
      </td>
    </tr>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </th>
  );
}
