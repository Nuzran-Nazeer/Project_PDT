import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listAudit } from "../../services/audit";
import { formatDate, formatDateTime } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/common/Icon";

// ⚠️ Read only: an entry cannot be edited or removed, so no control here suggests otherwise.
// ⚠️ Every line is the sentence the action wrote for itself, never re-rendered into a name.

const ACTION_LABELS = {
  identity_reveal: "Identity reveal",
  cycle_cancellation: "Cycle cancelled",
  colleague_list_decision: "Colleague list decision",
  history_edit: "History record edit",
};

const selectClass =
  "rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const pagerClass =
  "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

export default function AuditTrailPage() {
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    listAudit({ action, outcome, page: page > 1 ? page : "" })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [action, outcome, page]);

  const items = data?.items || [];
  const total = data?.total || 0;
  const pageSize = data?.pageSize || items.length;
  const lastPage = Math.max(1, Math.ceil(total / (pageSize || 1)));

  // Marked here rather than in the effect: the entry count and the pager keep the figures
  // from the last answer, so the controls do not disappear under the cursor mid-request.
  const reload = () => {
    setLoading(true);
    setError("");
  };

  const onFilter = (set) => (value) => {
    reload();
    set(value);
    setPage(1);
  };

  const onPage = (step) => () => {
    reload();
    setPage((current) => current + step);
  };

  return (
    <>
      <PageHeader
        title="Audit trail"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <p className="mb-4 max-w-prose text-sm text-muted">
        Every identity reveal, cycle cancellation, decision on a colleague list and edit
        to a dated record, newest first. A refused reveal is recorded alongside an allowed
        one. Nothing here can be changed or removed by anyone, which is what makes it
        worth reading. No entry names a colleague who gave feedback.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="action" className="sr-only">
          Action
        </label>
        <select
          id="action"
          value={action}
          onChange={(e) => onFilter(setAction)(e.target.value)}
          className={selectClass}
        >
          <option value="">Every action</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="outcome" className="sr-only">
          Outcome
        </label>
        <select
          id="outcome"
          value={outcome}
          onChange={(e) => onFilter(setOutcome)(e.target.value)}
          className={selectClass}
        >
          <option value="">Allowed and refused</option>
          <option value="allowed">Allowed only</option>
          <option value="refused">Refused only</option>
        </select>

        {data && (
          <p className="text-[13px] text-muted">
            {total === 1 ? "1 entry" : total + " entries"}
            {lastPage > 1 ? " · page " + page + " of " + lastPage : ""}
          </p>
        )}
      </div>

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
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
          {action || outcome
            ? "No entry matches that filter."
            : "Nothing has been recorded yet. The trail starts from the day it was built and does not reach back."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <Th>When</Th>
                <Th>Who acted</Th>
                <Th>What happened</Th>
                <Th>Who it concerned</Th>
                <Th>Reason</Th>
              </tr>
            </thead>

            <tbody>
              {items.map((entry) => (
                <tr key={entry._id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-muted">{formatDateTime(entry.at)}</td>

                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">
                      {entry.actorId?.name || "No longer on record"}
                    </span>
                    {entry.actorId?.employeeId && (
                      <span className="mt-0.5 block text-[12px] text-muted">
                        {entry.actorId.employeeId}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-ink">
                      {entry.detail || ACTION_LABELS[entry.action] || entry.action}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                      {ACTION_LABELS[entry.action] || entry.action}
                      {entry.outcome === "refused" && (
                        <span className="flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 font-medium text-danger">
                          <Icon name="shield" className="h-3 w-3" />
                          Refused
                        </span>
                      )}
                    </span>
                    <Period change={entry.change} />
                  </td>

                  <td className="px-4 py-3">
                    {entry.subjectUserId ? (
                      <>
                        <span className="text-ink">{entry.subjectUserId.name}</span>
                        {entry.subjectUserId.employeeId && (
                          <span className="mt-0.5 block text-[12px] text-muted">
                            {entry.subjectUserId.employeeId}
                          </span>
                        )}
                      </>
                    ) : (
                      <Missing action={entry.action} />
                    )}
                  </td>

                  <td className="max-w-xs px-4 py-3 text-muted">
                    {entry.reason ? (
                      <span className="whitespace-pre-wrap">{entry.reason}</span>
                    ) : (
                      <span className="text-[12px]">None was required</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={pagerClass}
            disabled={loading || page <= 1}
            onClick={onPage(-1)}
          >
            Newer
          </button>
          <button
            type="button"
            className={pagerClass}
            disabled={loading || page >= lastPage}
            onClick={onPage(1)}
          >
            Older
          </button>
        </div>
      )}
    </>
  );
}

// ⚠️ Two different absences arrive as the same empty field: a cancelled cycle covers a group
// and never had one person, while any other action lost the person its record pointed at. The
// action decides which, because saying "a whole group" about a reveal would be a lie.
function Missing({ action }) {
  return (
    <span className="text-muted">
      {action === "cycle_cancellation"
        ? "A whole group, not one person"
        : "No longer on record"}
    </span>
  );
}

// Both ends of the period an edit moved, which is the point of a history entry.
function Period({ change }) {
  if (!change?.from && !change?.to) return null;

  return (
    <span className="mt-1 block text-[12px] text-muted">
      {formatDate(change.from)} to {change.to ? formatDate(change.to) : "open"}
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
