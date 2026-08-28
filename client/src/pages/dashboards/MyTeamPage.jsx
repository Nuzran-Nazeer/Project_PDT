import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useTeam } from "../../hooks/useTeam";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/common/Icon";

// ⚠️ If a reviewer column is ever added here it is a COUNT, never a name and never a
// timestamp. In a team of eight the two together identify who wrote what.
export default function MyTeamPage() {
  const { user, isSupervisor } = useAuth();
  const { team, loading, error } = useTeam();

  const people = team?.team || [];
  const leads = team?.leads || [];

  return (
    <>
      <PageHeader
        title="My team"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      {leads.length > 0 && (
        <p className="mb-4 text-sm text-muted">
          You lead {leads.map((unit) => unit.name).join(", ")}.
        </p>
      )}

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
          {!isSupervisor
            ? "You do not lead a unit, so nobody reports to you."
            : leads.length === 0
              ? "You led a unit recently, but not today, so nobody reports to you at the moment."
              : "Nobody belongs to the unit you lead at the moment, so there is nobody to review."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <Th>Name</Th>
                <Th>Employee ID</Th>
                <Th>Designation</Th>
                <Th>Unit</Th>
                <Th>This cycle</Th>
                <Th>Review</Th>
              </tr>
            </thead>

            <tbody>
              {people.map((person) => (
                <tr key={person.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{person.name}</td>
                  <td className="px-4 py-3 text-muted">{person.employeeId}</td>
                  <td className="px-4 py-3 text-muted">{person.designation || "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {person.unit?.name || "—"}
                    {person.viaVacancy && (
                      <span className="mt-1 flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
                        <Icon name="flag" className="h-3.5 w-3.5" />
                        No lead of their own, so they report to you
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <CycleCell person={person} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/my-team/${person.id}`}
                      className="text-sm text-brand transition-colors hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {people.length > 0 && (
        <p className="mt-4 max-w-prose text-[13px] text-muted">
          <strong>This cycle</strong> is the appraisal cycle each person&rsquo;s group is
          in, which is not always yours: the group comes from the month they joined, so
          one team can span all three. Their own self-assessment and review status join
          this column once reviews exist.
        </p>
      )}
    </>
  );
}

// Three separate answers, and running them together loses the difference: no group at
// all, a group with no cycle running, and a live cycle.
function CycleCell({ person }) {
  if (!person.parGroup) return <span>&mdash;</span>;

  if (!person.cycle) {
    return <span>None running &middot; {person.parGroup} group</span>;
  }

  return (
    <span>
      {person.cycle.parGroup} {person.cycle.year}
      <span className="mt-1 block text-[12px]">
        {person.cycle.status.replace(/_/g, " ")}
      </span>
    </span>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </th>
  );
}
