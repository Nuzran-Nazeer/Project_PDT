import DashboardShell from "../../components/common/DashboardShell";

// Filled in by "Employee dashboard" — open cycle, self-assessment status, peer
// reviews assigned, published result awaiting acknowledgement, plan actions.
export default function EmployeeDashboard() {
  return (
    <DashboardShell
      title="My appraisal"
      description="What is outstanding, and what has been shared with you."
    />
  );
}
