import Icon from "../common/Icon";
import { formatDate } from "../../utils/dates";

// ⚠️ No progress bar: nothing measures a proportion completed yet.

const STAGE_LABELS = {
  open: "Open",
  collecting: "Collecting",
  supervisor_review: "Supervisor review",
  normalising: "Normalising",
  published: "Published",
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
    <div className="flex h-full flex-col justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 dark:bg-emerald-500/[0.08]">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
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
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {STAGE_LABELS[cycle.status] || cycle.status}
          </p>
        </div>
      </div>
    </div>
  );
}
