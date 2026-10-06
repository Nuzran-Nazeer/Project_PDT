import { useAuth } from "../../hooks/useAuth";
import { useReport } from "../../hooks/useReport";
import { getAuditCounts } from "../../services/reports";
import PageHeader from "../../components/layout/PageHeader";
import { Notice } from "../../components/reports/ReportParts";

// ⚠️ Bare numbers, company-wide. The one oversight signal that reaches outside HR, so it
// carries no name, no unit and nothing that says what was revealed.

export default function AuditCountsPage() {
  const { user } = useAuth();
  const { data, error, loading } = useReport(getAuditCounts);

  return (
    <>
      <PageHeader
        title="Audit counts"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <p className="mb-4 max-w-prose text-sm text-muted">
        How many times HR revealed who wrote a piece of colleague feedback, and how many
        times a dated history record was changed, per cycle. Counts only.
      </p>

      {error ? (
        <Notice tone="danger">{error}</Notice>
      ) : loading ? (
        <Notice tone="loading">Loading…</Notice>
      ) : data.cycles.length === 0 ? (
        <Notice>No cycle has opened yet.</Notice>
      ) : (
        <div className="workflow-table">
          <table className="w-full text-left text-sm">
            <thead className="text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Cycle</th>
                <th className="px-5 py-3 font-medium">Stage</th>
                <th className="px-5 py-3 text-right font-medium">Identity reveals</th>
                <th className="px-5 py-3 text-right font-medium">History record edits</th>
              </tr>
            </thead>
            <tbody>
              {data.cycles.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-5 py-3 font-medium text-ink">{c.label}</td>
                  <td className="px-5 py-3 capitalize text-muted">
                    {c.status.replace("_", " ")}
                  </td>
                  <td className="px-5 py-3 text-right text-ink tabular-nums">
                    {c.reveals}
                  </td>
                  <td className="px-5 py-3 text-right text-ink tabular-nums">
                    {c.historyEdits}
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
