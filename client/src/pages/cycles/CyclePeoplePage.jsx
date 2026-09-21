import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getCyclePeople } from "../../services/cycles";
import { publishReview } from "../../services/reviews";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/common/Icon";

// Nobody is listed here by choice: the roster is derived on the server from each
// person's group. ⚠️ Peer reviewers appear as a count, never named and never timed.

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

// Labels only. A review sits at pending until it is published or withdrawn.
const REVIEW_LABELS = {
  pending: "In progress",
  in_progress: "In progress",
  awaiting_supervisor: "Awaiting supervisor",
  normalising: "Normalising",
  published: "Published",
  acknowledged: "Published",
  under_appeal: "Published",
  withdrawn: "Withdrawn",
};

const isPublished = (review) => Boolean(review?.publishedAt);

export default function CyclePeoplePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = user?.roles?.some((role) => ["hr", "head_of_hr"].includes(role));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");

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

  const publishOne = async (person) => {
    setBusyId(person._id);
    setActionError("");
    try {
      await publishReview(person.review.id);
      setData(await getCyclePeople(id));
    } catch (err) {
      setActionError(`${person.name}: ${err.message}`);
    } finally {
      setBusyId("");
    }
  };

  const cycle = data?.cycle;
  const people = data?.items || [];
  const notAppraised = people.filter((p) => !p.appraised);
  // Only once the cycle has published: the server refuses it earlier anyway.
  const canPublishOne = canManage && cycle?.status === "published";

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
          {actionError && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
            >
              {actionError}
            </p>
          )}

          <p className="mb-4 text-sm text-muted">
            {/* People actually appraised, not rows: someone in no unit is listed but not counted. */}
            <strong className="text-ink">{data.appraised}</strong>
            {data.appraised === 1 ? " person is " : " people are "}
            covered by this cycle: everyone whose appraisal group is{" "}
            <strong className="text-ink">{cycle.parGroup}</strong>.
          </p>

          {people.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
              Nobody belongs to the {cycle.parGroup} group yet.
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
                        <Link
                          to={`/employees/${person._id}`}
                          className="transition-colors hover:text-brand"
                        >
                          {person.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{person.employeeId}</td>
                      <td className="px-4 py-3 text-muted">
                        {person.designation || "Not recorded"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {person.unit?.name || "No unit"}
                        {!person.appraised && (
                          // Shown, not dropped: a short count with nothing to explain it is worse.
                          <span className="mt-1 flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
                            <Icon name="flag" className="h-3.5 w-3.5" />
                            {person.notAppraisedBecause}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <ReviewState review={person.review} />
                        {/* Not while waiting: the row already says what it needs first. */}
                        {canPublishOne &&
                          person.review &&
                          !isPublished(person.review) &&
                          !person.review.waiting && (
                            <button
                              type="button"
                              disabled={busyId === person._id}
                              onClick={() => publishOne(person)}
                              className="mt-1.5 block cursor-pointer text-[12px] font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyId === person._id
                                ? "Publishing…"
                                : "Publish on its own"}
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {notAppraised.length > 0 && (
            <p className="mt-3 max-w-prose text-[13px] text-muted">
              {notAppraised.length === 1
                ? "One person is"
                : `${notAppraised.length} people are`}{" "}
              in this group but not appraised until placed in a unit, marked above.
            </p>
          )}
        </>
      )}
    </>
  );
}

function ReviewState({ review }) {
  if (!review) return <span>No review</span>;

  const date = review.publishedAt || review.withdrawnAt;
  const tone = review.publishedAt
    ? "text-emerald-700 dark:text-emerald-400"
    : review.withdrawnAt
      ? "text-amber-700 dark:text-amber-400"
      : "";

  return (
    <span className={tone}>
      {REVIEW_LABELS[review.status] || review.status}
      {date && <span className="text-muted"> · {formatDate(date)}</span>}
      {review.reinstatedAt && review.withdrawnAt && (
        <span className="mt-1 block text-[12px] text-muted">
          Set aside {formatDate(review.withdrawnAt)}, published later
        </span>
      )}
      {review.acknowledgedAt && (
        <span className="mt-1 block text-[12px] text-muted">
          Acknowledged {formatDate(review.acknowledgedAt)}
        </span>
      )}
      {review.waiting && <Waiting on={review.waiting} />}
    </span>
  );
}

// Left behind by a cycle that moved on. Derived on the server on every read, so it clears
// itself the moment the review catches up.
function Waiting({ on }) {
  const what =
    on.on === "summary_check"
      ? "the summary check"
      : on.supervisor
        ? on.supervisor.name
        : "a supervisor, and none is appointed";

  return (
    <span className="mt-1 flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
      <Icon name="clock" className="h-3.5 w-3.5" />
      Waiting on {what}
      <span className="text-muted">· {on.reason}</span>
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
