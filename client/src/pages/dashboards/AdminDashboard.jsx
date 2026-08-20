import DashboardShell from "../../components/common/DashboardShell";

// Filled in by "Admin dashboard" — system configuration and account operations
// only. No review, cycle, feedback or plan data appears here, by design.
export default function AdminDashboard() {
  return (
    <DashboardShell
      title="Administration"
      description="System configuration and account operations. No appraisal data appears here."
    />
  );
}
