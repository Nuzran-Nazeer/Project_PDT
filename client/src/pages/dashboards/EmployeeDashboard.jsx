import DashboardShell from "../../components/common/DashboardShell";
import MySupervisorPanel from "../../components/org/MySupervisorPanel";

// Filled in by "Employee dashboard" — open cycle, self-assessment status, peer
// reviews assigned, published result awaiting acknowledgement, plan actions.
//
// The supervisor panel is the exception and arrived first, from the reporting-line
// story: the endpoint answering who supervises whom was built, tested, and called by
// nothing across the whole of Sprint 1. This is the screen that calls it.
export default function EmployeeDashboard() {
  return (
    <DashboardShell
      title="My appraisal"
      description="What is outstanding, and what has been shared with you."
      panel={<MySupervisorPanel />}
    />
  );
}
