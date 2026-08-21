import DashboardShell from "../../components/common/DashboardShell";

// Filled in by "Head of HR dashboard" — the three monitoring flags, the full
// audit log, coverage assignments, and cycle progress across all units.
export default function HeadOfHrDashboard() {
  return (
    <DashboardShell
      title="Oversight"
      description="The audit record, the monitoring flags, and HR coverage across every unit."
    />
  );
}
