import { formatDate } from "../../utils/dates";
import {
  carriedTimesLabel,
  carryReasonLabel,
  planOutcomeLabel,
} from "../../utils/planLabels";

// The supervisor's and HR's view of a closed plan. ⚠️ Never the employee's page: their
// response carries no closure counts, and an action there never names a competency.

export function ClosureSummary({ plan }) {
  if (!plan?.closure) return null;

  const { closeDate, completed, carried } = plan.closure;

  return (
    <div className="mb-5 rounded-xl border border-line bg-raised p-4 text-sm">
      <p className="font-medium text-ink">
        Closed {formatDate(closeDate)} · {planOutcomeLabel(plan.outcome)}
      </p>

      <p className="mt-1 text-[13px] text-muted">
        {completed} completed · {carried} carried forward
        {plan.outcomeReason && ` · ${plan.outcomeReason}`}
      </p>

      <p className="mt-1 text-[13px] text-muted">
        Nothing further can be recorded. Carried actions arrive on the next plan.
      </p>
    </div>
  );
}

// The date it arrived with sits beside the new one, so a stale deadline is visible.
export function CarriedMarker({ action }) {
  if (!action.carriedTimes) return null;

  return (
    <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-400">
      {carriedTimesLabel(action.carriedTimes)}
      {action.carriedTargetDate &&
        ` · arrived due ${formatDate(action.carriedTargetDate)}`}
      {action.carryReason && ` · ${carryReasonLabel(action.carryReason)}`}
    </p>
  );
}
