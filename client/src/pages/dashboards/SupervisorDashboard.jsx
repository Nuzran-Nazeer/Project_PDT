import DashboardShell from "../../components/common/DashboardShell";

// Filled in by "Supervisor dashboard" — the team's submissions by name, peer
// reviewers as a count only, reviews owed, and plan actions by age.
//
// ⚠️ Nothing routes here yet. `supervisor` is derived from who leads a unit on a
// date, the org structure does not exist, and the role is deliberately absent
// from the token — so no user currently resolves to this screen. It is built now
// so the sixth dashboard does not appear later with no story owning it.
export default function SupervisorDashboard() {
  return (
    <DashboardShell
      title="My team"
      description="Your team's appraisal activity, and the reviews you owe."
    />
  );
}
