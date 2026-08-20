import DashboardShell from "../../components/common/DashboardShell";

// Filled in by "HR dashboard" — progress per appraisal group and per unit, the
// names behind each count, and summaries awaiting a check. Limited to the
// officer's covered units, which needs the org structure first.
export default function HrDashboard() {
  return (
    <DashboardShell
      title="Cycle progress"
      description="How each appraisal cycle is progressing across the units you cover."
    />
  );
}
