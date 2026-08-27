import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCyclePeople } from "../../services/cycles";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/common/Icon";

// The people one appraisal cycle covers.
//
// THE PEOPLE ARE REAL; THEIR REVIEW STATUS DOES NOT EXIST. Reviews, feedback and
// self-assessments have no model and no collection yet, so there is no state to report
// and the status column says so in those words. Showing every row as "Not started"
// would be a claim about their work rather than about the system, and it would read as
// true. Same decision, and the same wording, as the My team screen.
//
// NOBODY IS LISTED HERE BY CHOICE. A cycle covers a GROUP, and a person's group is
// derived from their joining date, so this list is worked out on the server when it is
// asked for. There is nothing to add somebody to and nothing to remove them from.
//
// ⚠️ WHEN REVIEW STATUS ARRIVES, IT IS NOT A REVIEWER COUNT WITH NAMES. Peer reviewers
// appear as a number and nothing else: in a small unit a name beside a submission time
// identifies who wrote what, which is the one thing this system exists to prevent.

const STAGE_LABELS = {
  draft: "Draft",
  open: "Open",
  collecting: "Collecting",
  supervisor_review: "Supervisor review",
  normalising: "Normalising",
  published: "Published",
  closed: "Closed",
  cancelled: "Cancelled",
};

export default function CyclePeoplePage() {
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Same shape as every other detail screen: a promise chain rather than an async
  // effect body, and `cancelled` so a slow response cannot write into a gone screen.
  useEffect(() => {
    let cancelled = false;

    getCyclePeople(id)
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [id]);

  const cycle = data?.cycle;
  const people = data?.items || [];
  const notAppraised = people.filter((p) => !p.appraised);

  return (
    <>
      <PageHeader
        title={cycle ? `${cycle.parGroup} group · ${cycle.year}` : "Appraisal cycle"}
        context={
          cycle
            ? `${STAGE_LABELS[cycle.status] || cycle.status} · ${formatDate(cycle.startDate)} to ${formatDate(cycle.endDate)}`
            : undefined
        }
      />

      <Link
        to="/cycles"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-brand"
      >
        <Icon name="arrowLeft" className="h-4 w-4" />
        Back to appraisal cycles
      </Link>

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
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {/* The count of people who are ACTUALLY covered, not of rows in the table.
                Anyone in the group without a unit is listed below but is not appraised,
                and a headline number that included them would be wrong by exactly the
                number of rows carrying a warning. */}
            <strong className="text-ink">{data.appraised}</strong>
            {data.appraised === 1 ? " person is " : " people are "}
            covered by this cycle. Nobody is added by hand: everyone whose appraisal group
            is <strong className="text-ink">{cycle.parGroup}</strong> is in it, and that
            group comes from their joining date.
          </p>

          {people.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
              Nobody belongs to the {cycle.parGroup} group, so this cycle covers no one.
              An appraisal group comes from a joining date, so this changes as people are
              taken on.
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
                    <tr key={person._id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-medium text-ink">
                        {/* Through to the employee record, which is the screen that
                            already answers every other question about this person.
                            Rebuilding any of it here would be a second copy to keep
                            right. */}
                        <Link
                          to={`/employees/${person._id}`}
                          className="transition-colors hover:text-brand"
                        >
                          {person.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{person.employeeId}</td>
                      <td className="px-4 py-3 text-muted">
                        {person.designation || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {person.unit?.name || "—"}
                        {!person.appraised && (
                          // Shown rather than hidden. Dropping these rows would leave
                          // the count short with nothing on screen to explain it, and
                          // "why is she not in the cycle" is exactly the question HR
                          // would then have to ask somebody.
                          <span className="mt-1 flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
                            <Icon name="flag" className="h-3.5 w-3.5" />
                            {person.notAppraisedBecause}
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
              self-assessment, the feedback collected about them and their supervisor
              review. None of those exist yet, so there is nothing for it to report.
            </p>
          )}

          {notAppraised.length > 0 && (
            <p className="mt-3 max-w-prose text-[13px] text-muted">
              {notAppraised.length === 1
                ? "One person is"
                : `${notAppraised.length} people are`}{" "}
              in this group but not appraised, marked above. Somebody who belongs to no
              unit has no supervisor, and nobody can review them until they are placed in
              one.
            </p>
          )}
        </>
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
