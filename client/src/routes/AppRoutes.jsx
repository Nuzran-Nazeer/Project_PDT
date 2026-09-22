import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import LandingRedirect from "./LandingRedirect";
import SignedOutRoute from "./SignedOutRoute";
import LoginPage from "../pages/LoginPage";
import ActivatePage from "../pages/ActivatePage";
import StatusPage from "../pages/StatusPage";
import Dashboard from "../pages/dashboards/Dashboard";
import PendingTabPage from "../pages/dashboards/PendingTabPage";
import MyTeamPage from "../pages/dashboards/MyTeamPage";
import NormalisationPage from "../pages/dashboards/NormalisationPage";
import SelfAssessmentPage from "../pages/appraisal/SelfAssessmentPage";
import FeedbackOwedPage from "../pages/appraisal/FeedbackOwedPage";
import MyResultPage from "../pages/appraisal/MyResultPage";
import SelfAssessmentFormPage from "../pages/appraisal/SelfAssessmentFormPage";
import PeerReviewFormPage from "../pages/appraisal/PeerReviewFormPage";
import TeamMemberPage from "../pages/appraisal/TeamMemberPage";
import TeamMemberAssessmentPage from "../pages/appraisal/TeamMemberAssessmentPage";
import CollectedResponsePage from "../pages/appraisal/CollectedResponsePage";
import SupervisorReviewFormPage from "../pages/appraisal/SupervisorReviewFormPage";
import NormalisationShell from "../pages/shells/NormalisationShell";
import EmployeeListPage from "../pages/employees/EmployeeListPage";
import EmployeeDetailPage from "../pages/employees/EmployeeDetailPage";
import EmployeeFormPage from "../pages/employees/EmployeeFormPage";
import OrgTreePage from "../pages/org/OrgTreePage";
import ProjectsPage from "../pages/projects/ProjectsPage";
import ProjectDetailPage from "../pages/projects/ProjectDetailPage";
import CyclesPage from "../pages/cycles/CyclesPage";
import CyclePeoplePage from "../pages/cycles/CyclePeoplePage";
import ReviewerListsPage from "../pages/reviewers/ReviewerListsPage";
import ChooseReviewersPage from "../pages/reviewers/ChooseReviewersPage";
import ReviewerListPage from "../pages/reviewers/ReviewerListPage";
import SummariesToCheckPage from "../pages/checks/SummariesToCheckPage";
import SummaryCheckPage from "../pages/checks/SummaryCheckPage";
import ReviewerIdentityPage from "../pages/identity/ReviewerIdentityPage";
import TeamPlansPage from "../pages/plans/TeamPlansPage";
import PlanPage from "../pages/plans/PlanPage";
import MyPlanPage from "../pages/plans/MyPlanPage";
import CoveragePlanPage from "../pages/plans/CoveragePlanPage";
import AuditTrailPage from "../pages/oversight/AuditTrailPage";
import MonitoringPage from "../pages/oversight/MonitoringPage";
import { TABS_BY_GROUP } from "../utils/dashboardTabs";

// ⚠️ Every gate here hides rather than protects: the real check is on the server.

// `null` means any signed-in user.
const GROUP_ACCESS = {
  employee: null,
  supervisor: ["supervisor"],
  hr: ["hr", "head_of_hr"],
  oversight: ["head_of_hr"],
  leadership: ["leadership"],
  admin: ["admin"],
};

const TAB_PAGES = {
  "my-team": MyTeamPage,
  normalisation: NormalisationPage,
  "reviewer-lists": ReviewerListsPage,
  "choose-reviewers": ChooseReviewersPage,
  "summaries-to-check": SummariesToCheckPage,
  "reviewer-identity": ReviewerIdentityPage,
  "team-plans": TeamPlansPage,
  "audit-trail": AuditTrailPage,
  monitoring: MonitoringPage,

  "my-self-assessment": SelfAssessmentPage,
  "feedback-i-owe": FeedbackOwedPage,
  "my-result": MyResultPage,
  "my-development-plan": MyPlanPage,
};

function AppRoutes() {
  return (
    <Routes>
      <Route element={<SignedOutRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Deliberately not behind SignedOutRoute: the code is the credential. */}
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/status" element={<StatusPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<LandingRedirect />} />

          <Route path="/dashboard" element={<Dashboard />} />

          {Object.entries(TABS_BY_GROUP).map(([group, tabs]) => {
            const allow = GROUP_ACCESS[group];
            // ⚠️ `ownRoute` tabs are skipped: a generated route would sit before the
            // hand-written one and quietly narrow its gate.
            const routes = tabs
              .filter((tab) => !tab.ownRoute)
              .map((tab) => {
                const Page = TAB_PAGES[tab.id];
                return (
                  <Route
                    key={tab.id}
                    path={tab.path}
                    element={Page ? <Page /> : <PendingTabPage tab={tab} />}
                  />
                );
              });

            return allow ? (
              <Route key={group} element={<ProtectedRoute allow={allow} />}>
                {routes}
              </Route>
            ) : (
              routes
            );
          })}

          {/* Per-role paths, kept as redirects. */}
          <Route element={<ProtectedRoute allow={["employee"]} />}>
            <Route path="/employee" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route element={<ProtectedRoute allow={["hr"]} />}>
            <Route path="/hr" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route element={<ProtectedRoute allow={["head_of_hr"]} />}>
            <Route path="/head-of-hr" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route element={<ProtectedRoute allow={["leadership"]} />}>
            <Route path="/leadership" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route element={<ProtectedRoute allow={["admin"]} />}>
            <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route element={<ProtectedRoute allow={["supervisor"]} />}>
            <Route path="/supervisor" element={<Navigate to="/dashboard" replace />} />
          </Route>

          {/* Drill-downs, not sidebar destinations. */}
          <Route path="/my-self-assessment/form" element={<SelfAssessmentFormPage />} />
          <Route
            path="/feedback-i-owe/form"
            element={<Navigate to="/feedback-i-owe" replace />}
          />
          <Route path="/feedback-i-owe/:id" element={<PeerReviewFormPage />} />

          <Route element={<ProtectedRoute allow={["supervisor"]} />}>
            <Route path="/my-team/:id" element={<TeamMemberPage />} />
            <Route
              path="/my-team/:id/self-assessment"
              element={<TeamMemberAssessmentPage />}
            />
            {/* ⚠️ Addressed by label: the real id never leaves the server. */}
            <Route
              path="/my-team/:id/feedback/:label"
              element={<CollectedResponsePage />}
            />
            <Route path="/my-team/:id/review" element={<SupervisorReviewFormPage />} />
            <Route path="/my-team/:id/normalisation" element={<NormalisationShell />} />
            <Route path="/team-plans/:id" element={<PlanPage />} />
          </Route>

          {/* HR too: HR decides and draws, and confirms for somebody nobody supervises. */}
          <Route element={<ProtectedRoute allow={["supervisor", "hr", "head_of_hr"]} />}>
            <Route path="/reviewer-lists/:reviewId" element={<ReviewerListPage />} />
          </Route>

          <Route element={<ProtectedRoute allow={["hr", "head_of_hr"]} />}>
            <Route path="/summaries-to-check/:reviewId" element={<SummaryCheckPage />} />
          </Route>

          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/employees" element={<EmployeeListPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          </Route>
          {/* Not leadership: they reach an employee record but never their plan. */}
          <Route element={<ProtectedRoute allow={["hr", "head_of_hr"]} />}>
            <Route path="/employees/:id/plan" element={<CoveragePlanPage />} />
          </Route>
          <Route element={<ProtectedRoute allow={["hr"]} />}>
            <Route path="/employees/new" element={<EmployeeFormPage />} />
            <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
          </Route>

          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/cycles" element={<CyclesPage />} />
            <Route path="/cycles/:id/people" element={<CyclePeoplePage />} />
          </Route>

          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/organisation" element={<OrgTreePage />} />
            <Route path="/organisation/:id" element={<OrgTreePage />} />
          </Route>

          {/* An HR officer reaches every project; a write about somebody they do not
              cover is refused in the response rather than as a missing button. */}
          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
