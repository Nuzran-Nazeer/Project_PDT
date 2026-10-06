import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useReport } from "../../hooks/useReport";
import { getRatingDistribution } from "../../services/reports";
import { SEQUENTIAL, percent } from "../../utils/reportScale";
import PageHeader from "../../components/layout/PageHeader";
import {
  CycleSelect,
  Notice,
  SegmentBar,
  SuppressedCard,
} from "../../components/reports/ReportParts";

// ⚠️ Counts of scores only. There is no overall rating to average: that belongs to
// normalisation, which is not built.

const BANDS = ["1", "2", "3", "4", "5"];

const segmentsOf = (bands) =>
  BANDS.map((band, i) => ({
    label: `Rated ${band}`,
    count: bands?.[band] || 0,
    className: SEQUENTIAL[i],
  }));

export default function RatingDistributionPage() {
  const { user } = useAuth();
  const [cycle, setCycle] = useState("");
  const { data, error, loading } = useReport(getRatingDistribution, cycle);

  return (
    <>
      <PageHeader
        title="Rating distribution"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <p className="mb-4 max-w-prose text-sm text-muted">
        How supervisors scored each competency on published results, company-wide and for
        each main unit. No names, and no figure for a group under {data?.floor ?? 5}{" "}
        people.
      </p>

      {error ? (
        <Notice tone="danger">{error}</Notice>
      ) : loading ? (
        <Notice tone="loading">Loading…</Notice>
      ) : !data.cycle ? (
        <Notice>No cycle has published results yet.</Notice>
      ) : (
        <>
          <CycleSelect cycles={data.cycles} value={data.cycle.id} onChange={setCycle} />

          <div className="grid min-w-0 grid-cols-1 gap-4">
            {data.groups.map((group) =>
              group.suppressed ? (
                <SuppressedCard key={group.key} name={group.name} floor={data.floor} />
              ) : (
                <GroupCard key={group.key} group={group} floor={data.floor} />
              ),
            )}
          </div>
        </>
      )}
    </>
  );
}

function GroupCard({ group, floor }) {
  const scored = BANDS.reduce((sum, band) => sum + (group.bands[band] || 0), 0);

  return (
    <section className="rounded-xl border border-line bg-raised p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium text-ink">{group.name}</h2>
        <p className="text-[13px] text-muted">
          {group.people} published results · {scored} scores
        </p>
      </div>

      <SegmentBar
        label={`${group.name}, every competency`}
        segments={segmentsOf(group.bands)}
      />

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">
          By competency
        </summary>

        <div className="workflow-table mt-3">
          <table className="w-full text-left text-sm">
            <thead className="text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">Competency</th>
                {BANDS.map((band) => (
                  <th key={band} className="px-2 py-2 text-right font-medium">
                    {band}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium">Not observed</th>
              </tr>
            </thead>
            <tbody>
              {group.competencies.map((c) => (
                <tr key={c.key} className="border-t border-line">
                  <td className="py-2 pr-4 text-ink">{c.name}</td>
                  {c.suppressed ? (
                    <td colSpan={BANDS.length + 1} className="px-2 py-2 text-muted">
                      Rated for fewer than {floor} people
                    </td>
                  ) : (
                    <>
                      {BANDS.map((band) => {
                        const total = c.people - c.notObserved;
                        return (
                          <td
                            key={band}
                            className="px-2 py-2 text-right text-ink tabular-nums"
                          >
                            {c.bands[band]}
                            <span className="ml-1 text-muted">
                              ({percent(c.bands[band], total)}%)
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-right text-muted tabular-nums">
                        {c.notObserved}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
