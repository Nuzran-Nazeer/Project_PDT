import { useAuth } from "../../hooks/useAuth";
import { useCurrentCycle } from "../../hooks/useCurrentCycle";
import PageHeader from "../../components/layout/PageHeader";
import ShellTable, { Pill } from "../../components/shells/ShellTable";

// What the employee finally sees.
//
// ⚠️ Three things stay absent when this becomes real: no reviewer named, no response
// count, no raw colleague rating. Read those before adding a column.
export default function MyResultShell() {
  const { user, constants } = useAuth();
  const { cycle } = useCurrentCycle();

  const competencies = constants?.competencies?.[user?.jobFamily] || [];

  const rows = competencies.map((competency) => ({
    key: competency.key,
    cells: [competency.name, "Not published", <Pill>No result yet</Pill>],
  }));

  return (
    <>
      <PageHeader
        title="My result"
        context={
          cycle
            ? `${cycle.parGroup} ${cycle.year} · ${cycle.status.replace(/_/g, " ")}`
            : [user?.designation, user?.name].filter(Boolean).join(" · ")
        }
        backTo="/dashboard"
      />

      <ShellTable
        heading="My result"
        columns={["Competency", "Outcome", "Status"]}
        rows={rows}
        empty="No competency set could be read for your job family."
      />

      <p className="mt-4 max-w-prose text-[13px] text-muted">
        When a result is published it carries your supervisor's assessment and a written
        summary of what colleagues said. It will never name a colleague, say how many
        responded, or show their individual ratings.
      </p>
    </>
  );
}
