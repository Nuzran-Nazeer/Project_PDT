import WorkflowNotice from "../../components/common/WorkflowNotice";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import { getTeamLists } from "../../services/reviewerLists";
import { stateLabel } from "../../utils/reviewerListStates";

const startOf = (item) =>
  item.cycle?.startDate ? new Date(item.cycle.startDate).getTime() : Infinity;

export default function ReviewerListsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getTeamLists()
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const items = [...(data?.items || [])].sort(
    (a, b) => startOf(a) - startOf(b) || a.person.name.localeCompare(b.person.name),
  );

  return (
    <>
      <PageHeader
        title="Reviewer lists"
        context="Confirm who worked with each person while their cycle is collecting. HR approves any removal or addition, then draws the reviewers."
        backTo="/dashboard"
      />

      {error ? (
        <WorkflowNotice tone="error">{error}</WorkflowNotice>
      ) : !data ? (
        <WorkflowNotice tone="loading">Loading…</WorkflowNotice>
      ) : items.length === 0 ? (
        <WorkflowNotice>Nobody reports to you at the moment.</WorkflowNotice>
      ) : (
        <div className="workflow-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <Th>Name</Th>
                <Th>Their cycle</Th>
                <Th>List</Th>
                <Th>Requests waiting</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const state = stateLabel(item.state);
                return (
                  <tr key={item.person.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{item.person.name}</td>
                    <td className="px-4 py-3 text-muted">
                      {item.cycle
                        ? `${item.cycle.parGroup} ${item.cycle.year} · ${item.cycle.status.replace(/_/g, " ")}`
                        : "No cycle running"}
                    </td>
                    <td className={`px-4 py-3 ${state.tone}`}>{state.label}</td>
                    <td className="px-4 py-3 text-muted">
                      {item.pendingChanges || "None"}
                    </td>
                    <td className="px-4 py-3">
                      {item.reviewId ? (
                        <Link
                          to={`/reviewer-lists/${item.reviewId}`}
                          className="text-sm text-ink transition-colors hover:underline"
                        >
                          Open
                        </Link>
                      ) : (
                        <span className="text-muted">No review</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
