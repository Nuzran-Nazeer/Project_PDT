import Icon from "../common/Icon";
import { formatDate } from "../../utils/dates";

// ⚠️ No progress bar: nothing measures a proportion completed yet.

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

export default function CycleCard({ cycle, parGroup, loading }) {
  if (loading) {
    return (
      <div className="flex h-full flex-col justify-center rounded-xl border border-dashed border-line p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          Appraisal cycle
        </p>
        <p className="mt-2 text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="flex h-full flex-col justify-center rounded-xl border border-dashed border-line p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          Appraisal cycle
        </p>
        <p className="mt-2 text-sm text-muted">
          {parGroup
            ? `The ${parGroup} group has no cycle running at the moment.`
            : "You are not in an appraisal group."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center rounded-xl border border-line bg-raised p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-muted">
          <Icon name="target" className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">
            {cycle.parGroup} group · {cycle.year}
          </p>
          <p className="truncate text-[13px] text-muted">
            {formatDate(cycle.startDate)} to {formatDate(cycle.endDate)}
          </p>
        </div>

        <div className="shrink-0">
          <p className="text-[13px] text-muted">Stage</p>
          <p className="text-sm font-semibold text-ink">
            {STAGE_LABELS[cycle.status] || cycle.status}
          </p>
        </div>
      </div>
      {cycle.status === "cancelled" ? (
        <p className="mt-4 text-sm text-danger">This cycle was cancelled.</p>
      ) : (
        <ol aria-label="Appraisal stage sequence" className="mt-5 flex gap-1">
          {Object.entries(STAGE_LABELS)
            .filter(([stage]) => stage !== "cancelled")
            .map(([stage, label]) => (
              <li
                key={stage}
                aria-current={cycle.status === stage ? "step" : undefined}
                className="min-w-0 flex-1"
              >
                <span
                  className={
                    "mb-2 block h-1 rounded-full " +
                    (cycle.status === stage ? "bg-brand" : "bg-secondary")
                  }
                />
                <span
                  className={
                    "block break-words text-[9px] " +
                    (cycle.status === stage ? "font-semibold text-ink" : "text-muted")
                  }
                >
                  {label}
                </span>
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}
