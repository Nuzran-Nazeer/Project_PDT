import { formatDate } from "../../utils/dates";
import {
  categoryLabel,
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

      <ApprovalMarker approval={detail.approval} />
      <OutcomeMarkers detail={detail} />
    </div>
  );
}

// ⚠️ Neither of these closes the plan. An extension moves the end date and an escalation
// hands it to HR, and the plan runs on through both.
function OutcomeMarkers({ detail }) {
  return (
    <>
      {detail.extension && (
        <div className="mt-3 border-t border-line pt-3 text-[13px]">
          <p className="text-ink">
            Extended by {detail.extension.days} days, from{" "}
            {formatDate(detail.extension.previousEndDate)} ·{" "}
            {detail.extension.by?.name || "their supervisor"} on{" "}
            {formatDate(detail.extension.at)}
          </p>
          <p className="mt-1 whitespace-pre-line text-muted">{detail.extension.reason}</p>
        </div>
      )}

      {detail.escalation && (
        <div className="mt-3 border-t border-line pt-3 text-[13px]">
          <p className="text-danger">
            Escalated to HR by {detail.escalation.by?.name || "their supervisor"} on{" "}
            {formatDate(detail.escalation.at)}
          </p>
          <p className="mt-1 whitespace-pre-line text-muted">{detail.escalation.note}</p>
        </div>
      )}
    </>
  );
}

// The plan as an officer reads it: its details and the actions they have to form a view on.
export function ImprovementPlanSummary({ plan }) {
  return (
    <>
      <ImprovementDetails plan={plan} />

      <ul className="grid gap-3">
        {plan.actions.map((action) => (
          <li key={action.id} className="rounded-lg border border-line p-4 text-sm">
            <p className="font-medium text-ink">{action.description}</p>

            <p className="mt-2 text-[13px] text-muted">
              {categoryLabel(action.category)} · {action.competencyName} ·{" "}
              {action.owner?.name || "Not recorded"} · due {formatDate(action.targetDate)}
            </p>

            <p className="mt-2 text-[13px] text-muted">
              <span className="font-medium text-ink">Success criterion: </span>
              {action.successCriteria}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

// Shown to the supervisor as well as to HR: a refused plan says why, and the supervisor
// cannot read the audit trail.
export function ApprovalMarker({ approval }) {
  if (!approval) return null;

  const refused = approval.decision === "refused";

  return (
    <div className="mt-3 border-t border-line pt-3 text-[13px]">
      <p className={refused ? "text-danger" : "text-success"}>
        {refused ? "Sent back by" : "Approved by"} {approval.by?.name || "an HR officer"}{" "}
        on {formatDate(approval.at)}
      </p>

      {approval.reason && (
        <p className="mt-1 whitespace-pre-line text-muted">{approval.reason}</p>
      )}
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
