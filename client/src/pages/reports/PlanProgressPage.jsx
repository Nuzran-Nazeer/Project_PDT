import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useReport } from "../../hooks/useReport";
import { getPlanProgress } from "../../services/reports";
import { formatDate } from "../../utils/dates";
import { SEQUENTIAL } from "../../utils/reportScale";
import PageHeader from "../../components/layout/PageHeader";
import {
  CycleSelect,
  Notice,
  SegmentBar,
  SuppressedCard,
} from "../../components/reports/ReportParts";

const STATES = [
  { key: "not_started", label: "Not started", className: SEQUENTIAL[0] },
  { key: "in_progress", label: "In progress", className: SEQUENTIAL[2] },
  { key: "done", label: "Complete", className: SEQUENTIAL[4] },
  { key: "carried_forward", label: "Carried forward", className: "bg-line" },
];

export default function PlanProgressPage() {
  const { user } = useAuth();
  const [cycle, setCycle] = useState("");
  const { data, error, loading } = useReport(getPlanProgress, cycle);

  return (
    <>
      <PageHeader
        title="Plan progress"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <p className="mb-4 max-w-prose text-sm text-muted">
        Development plan actions agreed on a cycle&apos;s results, by state, company-wide
        and for each main unit. A plan still being drafted is not counted. No names, and
        no figure for a group under {data?.floor ?? 5} people.
      </p>

      {error ? (
        <Notice tone="danger">{error}</Notice>
      ) : loading ? (
        <Notice>Loading…</Notice>
      ) : !data.cycle ? (
        <Notice>No cycle has published results yet.</Notice>
      ) : (
        <>
          <CycleSelect cycles={data.cycles} value={data.cycle.id} onChange={setCycle} />

          <p className="mb-4 text-[13px] text-muted">
            {data.lastCheckInPoint
              ? `Not moved since the last check-in point, ${formatDate(data.lastCheckInPoint)}: counted per group below.`
              : "No check-in point has passed yet for this cycle, so no action can be behind one."}
          </p>

          <div className="grid gap-4">
            {data.groups.map((group) =>
              group.suppressed ? (
                <SuppressedCard key={group.key} name={group.name} floor={data.floor} />
              ) : (
                <section
                  key={group.key}
                  className="rounded-xl border border-line bg-raised p-5"
                >
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-medium text-ink">{group.name}</h2>
                    <p className="text-[13px] text-muted">
                      {group.people} people · {group.total} actions · {group.stale} not
                      moved since the last check-in point
                    </p>
                  </div>

                  <SegmentBar
                    label={`${group.name}, plan actions`}
                    segments={STATES.map((s) => ({
                      label: s.label,
                      count: group.actions[s.key] || 0,
                      className: s.className,
                    }))}
                  />
                </section>
              ),
            )}
          </div>
        </>
      )}
    </>
  );
}
