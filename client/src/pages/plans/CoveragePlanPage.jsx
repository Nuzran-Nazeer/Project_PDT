import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPlanForCoverage } from "../../services/plans";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import { FormSection } from "../../components/shells/FormShell";
import { CheckInEntries, CheckInSchedule } from "../../components/plans/CheckIns";
import { categoryLabel, actionStatusLabel, daysSinceLabel } from "../../utils/planLabels";

// HR's read of a plan within their coverage, the same view the supervisor gets.
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
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getPlanForCoverage(id)
      .then((data) => !cancelled && setPlan(data))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <>
        <PageHeader title="Development plan" backTo={`/employees/${id}`} />
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
        <PageHeader title="Development plan" backTo={`/employees/${id}`} />
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Development plan"
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
      <div className="mt-5">
        <FormSection letter="B" title="Check-ins">
          <CheckInSchedule summary={plan.checkIns} />

          <div className="mt-4">
            <CheckInEntries entries={plan.checkIns?.entries} />
          </div>
        </FormSection>
      </div>
    </>
  );
}
