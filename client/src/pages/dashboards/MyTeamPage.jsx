import { useAuth } from "../../hooks/useAuth";
import { useTeam } from "../../hooks/useTeam";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/common/Icon";

// The people a supervisor supervises. Story 17, criterion 1.
//
// THE PEOPLE ARE REAL; THEIR SUBMISSIONS ARE NOT. The criterion asks for the team's
// submissions listed by name, and there is no cycle, review or feedback collection
// for a submission status to come from. So the list is real and the status column
// says plainly that it does not exist yet, rather than showing every row as "not
// started" — which would be a claim about their work rather than about the system.
//
// NOTHING HERE IS A COUNT OF REVIEWERS. Criterion 2 says peer reviewers appear as a
// count only, never named and never timed. When that column arrives it is a number
// and nothing else: in a team of eight, a name and a timestamp together identify who
// wrote what, which is the whole thing this system exists to prevent.
//
// The team comes from a hook that takes no id, so this screen cannot ask about
// anybody else's team even by accident.
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
        <p role="alert" className="rounded-xl border border-line bg-raised p-5 text-sm text-danger">
          {error}
        </p>
      ) : loading ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      ) : people.length === 0 ? (
        // Three different empty answers, and they mean different things. Somebody who
        // leads nothing is not a supervisor at all; somebody who leads an empty unit
        // is. Collapsing them into one sentence would tell one of the two something
        // false about their own position.
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
                      // Without this, somebody from a unit the supervisor does not
                      // lead appears on their list with no explanation and reads as a
                      // bug. It is the mirror of the note an employee sees when their
                      // own supervisor was resolved upward.
                      <span className="mt-1 flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
                        <Icon name="flag" className="h-3.5 w-3.5" />
                        No lead of their own, so they report to you
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">Not built yet</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {people.length > 0 && (
        <p className="mt-4 max-w-prose text-[13px] text-muted">
          The <strong>This cycle</strong> column will show each person&rsquo;s
          self-assessment and review status. No appraisal cycle exists yet, so there is
          nothing for it to report.
        </p>
      )}
    </>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </th>
  );
}
