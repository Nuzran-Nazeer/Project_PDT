import { useAuth } from "../../hooks/useAuth";
import { useCurrentCycle } from "../../hooks/useCurrentCycle";
import { useReportingLine } from "../../hooks/useReportingLine";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import CompetencyRows from "../../components/shells/CompetencyRows";
import { FormShell, FormSection, FormActions } from "../../components/shells/FormShell";

// The self-assessment form, lettered A to D as the review-forms walkthrough letters it.
// Section A is real and system-filled; B needs development plans, which are out of scope.
export default function SelfAssessmentFormShell() {
  const { user } = useAuth();
  const { cycle } = useCurrentCycle();
  const { line } = useReportingLine();

  const supervisor = line?.supervisor;

  return (
    <>
      <PageHeader
        title="My self-assessment"
        context={
          cycle
            ? `${cycle.parGroup} group · ${cycle.year}`
            : [user?.designation, user?.name].filter(Boolean).join(" · ")
        }
        backTo="/dashboard"
      />

      <FormShell>
        <FormSection
          letter="A"
          title="Cycle context"
          note="Read-only, filled by the system. Nothing in this section is typed by you."
        >
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Fact label="Employee ID" value={user?.employeeId} />
            <Fact label="Designation" value={user?.designation} />
            <Fact label="Job family" value={user?.jobFamily} />
            <Fact label="Appraisal group" value={user?.parGroup} />
            <Fact label="Joined" value={formatDate(user?.joinedDate)} />
            <Fact
              label="Cycle"
              value={
                cycle
                  ? `${cycle.parGroup} ${cycle.year} · ${formatDate(cycle.startDate)} to ${formatDate(cycle.endDate)}`
                  : "None running"
              }
            />
            {/* ⚠️ One supervisor shown, and there can be two. Becomes a list of periods. */}
            <Fact label="Supervisor this cycle" value={supervisor?.name || "None"} />
          </dl>
        </FormSection>

        <FormSection
          letter="B"
          title="Progress against last cycle's goals"
          note="Each goal from your last development plan, with what happened to it."
        >
          <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
            Nothing to show. Development plans are not part of this release, so there are
            no goals to carry forward yet.
          </p>
        </FormSection>

        <FormSection
          letter="C"
          title="Competency self-rating"
          note="A rating from 1 to 5 with written evidence. Evidence is required: a number on its own will be refused."
        >
          <CompetencyRows
            jobFamily={user?.jobFamily}
            prompt={(competency) => competency.definition}
          />
        </FormSection>

        <FormSection letter="D" title="Reflection">
          <div className="grid gap-3">
            <Prompt>Biggest achievement this cycle</Prompt>
            <Prompt>Biggest challenge</Prompt>
            <Prompt>Support or training I need next cycle</Prompt>
          </div>
        </FormSection>

        <FormSection title="Declaration">
          <p className="max-w-prose text-sm text-muted">
            &ldquo;I confirm this self-assessment is my own honest reflection.&rdquo;
            Signed with your name and the time you submit.
          </p>
        </FormSection>

        <FormActions
          backTo="/my-self-assessment"
          backLabel="Back to my self-assessment"
        />
      </FormShell>
    </>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}

function Prompt({ children }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink">{children}</p>
      <div className="mt-1.5 rounded-lg border border-dashed border-line px-3.5 py-3 text-[13px] text-muted">
        Written answer
      </div>
    </div>
  );
}
