import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPlanForCoverage, getImprovementPlansForCoverage } from "../../services/plans";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";
import { CheckInEntries, CheckInSchedule } from "../../components/plans/CheckIns";
import {
  ClosureSummary,
  CarriedMarker,
  SuspensionNotice,
} from "../../components/plans/PlanClosure";
import { ImprovementPlanSummary } from "../../components/plans/ImprovementPlan";
import { categoryLabel, actionStatusLabel, daysSinceLabel } from "../../utils/planLabels";

// HR's read of an employee's plans within their coverage, development and improvement.
// ⚠️ Read only, and it offers no control that would suggest otherwise.

function Row({ label, children }) {
  return (
    <div>
      <dt className="inline font-medium text-ink">{label}: </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}

export default function CoveragePlanPage() {
  const { id } = useParams();

  const [plan, setPlan] = useState(null);
  const [improvement, setImprovement] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getPlanForCoverage(id)
      .then((data) => !cancelled && setPlan(data))
      .catch((err) => !cancelled && setError(err.message));

    // Refused where the employee has never had one, which is not an error on this page.
    getImprovementPlansForCoverage(id)
      .then((data) => !cancelled && setImprovement(data.plans))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <>
        <PageHeader title="Plans" backTo={`/employees/${id}`} />
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <PageHeader title="Plans" backTo={`/employees/${id}`} />
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Plans"
        context={[
          plan.employee?.name,
          plan.sharedAt && `Shared ${formatDate(plan.sharedAt)}`,
          plan.acknowledgedAt
            ? `Acknowledged ${formatDate(plan.acknowledgedAt)}`
            : "Not acknowledged",
        ]
          .filter(Boolean)
          .join(" · ")}
        backTo={`/employees/${id}`}
      />

      <ClosureSummary plan={plan} />
      <SuspensionNotice plan={plan} />

      <FormSection letter="A" title="Actions">
        <ul className="grid gap-3">
          {plan.actions.map((action) => (
            <li key={action.id} className="rounded-lg border border-line p-4 text-sm">
              <p className="font-medium text-ink">{action.description}</p>

              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] text-muted sm:grid-cols-2">
                <Row label="Category">{categoryLabel(action.category)}</Row>
                <Row label="From competency">{action.competencyName}</Row>
                <Row label="Owner">{action.owner?.name || "Not recorded"}</Row>
                <Row label="Target date">{formatDate(action.targetDate)}</Row>
                <Row label="State">
                  {actionStatusLabel(action.status)}
                  {daysSinceLabel(action.daysSinceChange) &&
                    ` · ${daysSinceLabel(action.daysSinceChange)}`}
                </Row>
              </dl>

              <p className="mt-3 text-[13px] text-muted">
                <span className="font-medium text-ink">Success criterion: </span>
                {action.successCriteria}
              </p>

              <CarriedMarker action={action} />

              {action.progressNotes.length > 0 && (
                <ul className="mt-3 grid gap-2 border-t border-line pt-3">
                  {action.progressNotes.map((note, i) => (
                    <li key={i} className="text-[13px] text-muted">
                      <span className="whitespace-pre-line">{note.note}</span>
                      <span className="mt-0.5 block text-[12px]">
                        {note.by?.name || "Unknown"} · {formatDate(note.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </FormSection>

      {/* Read only, the same as the actions above: this page offers no control. */}
      <div className="mt-5 grid gap-5">
        <FormSection letter="B" title="Check-ins">
          <CheckInSchedule summary={plan.checkIns} />

          <div className="mt-4">
            <CheckInEntries entries={plan.checkIns?.entries} />
          </div>
        </FormSection>

        {improvement.length > 0 && (
          <FormSection
            letter="C"
            title="Improvement plans"
            note="Open and closed, newest first."
          >
            <div className="grid gap-5">
              {improvement.map((one) => (
                <div key={one.id}>
                  <ImprovementPlanSummary plan={one} />

                  <div className="mt-4">
                    <CheckInSchedule summary={one.checkIns} kind="meeting" />
                  </div>

                  <div className="mt-4">
                    <CheckInEntries entries={one.checkIns?.entries} kind="meeting" />
                  </div>
                </div>
              ))}
            </div>
          </FormSection>
        )}
      </div>
    </>
  );
}
