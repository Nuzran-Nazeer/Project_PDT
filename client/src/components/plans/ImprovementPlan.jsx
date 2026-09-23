import { formatDate } from "../../utils/dates";
import {
  improvementTypeLabel,
  triggerLabel,
  planStatusLabel,
  daysRemainingLabel,
  PLAN_STATUS_TONE,
} from "../../utils/planLabels";

// The supervisor's and HR's view of an improvement plan. ⚠️ Never the employee's page: the
// case type and the competency it was raised over are HR's, and their page carries neither.

export function ImprovementDetails({ plan }) {
  const detail = plan?.improvement;
  if (!detail) return null;

  const competency = plan.competencies?.find((c) => c.key === detail.forCompetency);

  return (
    <div className="mb-5 rounded-xl border border-line bg-raised p-4 text-sm">
      <p className={`font-medium ${PLAN_STATUS_TONE[plan.status] || "text-ink"}`}>
        {planStatusLabel(plan.status)}
      </p>

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] text-muted sm:grid-cols-2">
        <Row label="Type">{improvementTypeLabel(detail.type)}</Row>
        <Row label="Raised over">{competency?.name || detail.forCompetency}</Row>
        <Row label="Length">{detail.durationDays} days</Row>
        <Row label="Started from">{triggerLabel(detail.trigger?.source)}</Row>

        {/* The dates are fixed at sharing, so a plan on its way through HR has none yet. */}
        {detail.endDate ? (
          <>
            <Row label="Runs">
              {formatDate(plan.startDate)} to {formatDate(detail.endDate)}
            </Row>
            <Row label="Remaining">{daysRemainingLabel(detail.daysRemaining)}</Row>
          </>
        ) : (
          <Row label="Runs">{detail.durationDays} days from the day it is shared</Row>
        )}
      </dl>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium text-ink">{label}:</dt>
      <dd>{children}</dd>
    </div>
  );
}
