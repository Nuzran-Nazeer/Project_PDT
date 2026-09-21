import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { listSummaryChecks } from "../../services/reviews";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/common/Icon";

// The list is the server's: owed within the officer's coverage, oldest settlement first.
// A review with no colleague section, or one the officer supervises, is never here.
export default function SummariesToCheckPage() {
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    listSummaryChecks()
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, []);

  const items = data?.items || [];

  return (
    <>
      <PageHeader
        title="Summaries to check"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <p className="mb-4 max-w-prose text-sm text-muted">
        Listed once the supervisor's review settles.
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      ) : !data ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
          No summary is waiting for a check within your coverage.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <Th>Employee</Th>
                <Th>Supervisor</Th>
                <Th>Cycle</Th>
                <Th>Settled</Th>
                <Th>Check</Th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.reviewId} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{item.employee?.name}</span>
                    <span className="mt-0.5 block text-[12px] text-muted">
                      {[item.employee?.employeeId, item.employee?.designation]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.supervisor?.name || "Nobody appointed"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.cycle?.parGroup} {item.cycle?.year}
                    <span className="mt-0.5 block text-[12px]">
                      {item.cycle?.status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(item.settledAt)}
                    {item.summaryEmpty && (
                      <span className="mt-1 flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
                        <Icon name="flag" className="h-3.5 w-3.5" />
                        The summary is empty
                      </span>
                    )}
                    {item.lastCheck?.action === "sent_back" && (
                      <span className="mt-1 block text-[12px]">
                        Resubmitted after a send-back on {formatDate(item.lastCheck.at)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/summaries-to-check/${item.reviewId}`}
                      className="text-sm text-brand transition-colors hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
