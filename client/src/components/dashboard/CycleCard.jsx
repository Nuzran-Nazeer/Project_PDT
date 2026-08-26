import Icon from "../common/Icon";
import { SHOW_PLACEHOLDER_FIGURES } from "../../dev/placeholderFigures";

// The cycle banner beside the greeting: which appraisal cycle is running, where it
// stands, and what is due.
//
// ⚠️ ALL OF IT IS INVENTED TODAY. There is no cycle collection on the server, so there
// is no cycle to read. When the flag in dev/placeholderFigures.js is turned off this
// card says so in plain words rather than showing a bar at nought percent, because a
// progress bar at nought is itself a claim: it says the cycle exists and nobody has
// done anything, which is a different and false statement.
//
// The first thing that makes this real is seeding a cycle and the competency set on
// the server. That is one seed script, and it turns this card, the self-assessment
// tab and two of the four tiles into real screens at once.
export default function CycleCard({ cycle }) {
  if (!SHOW_PLACEHOLDER_FIGURES || !cycle) {
    return (
      <div className="rounded-xl border border-dashed border-line p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          Appraisal cycle
        </p>
        <p className="mt-2 text-sm text-muted">
          No cycle has been created yet, so there is nothing running to report on.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 dark:bg-emerald-500/[0.08]">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <Icon name="target" className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{cycle.title}</p>
          <p className="truncate text-[13px] text-muted">{cycle.detail}</p>
        </div>

        <div className="min-w-[180px] flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-muted">{cycle.metricLabel}</span>
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {cycle.metricValue}
            </span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${cycle.percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
