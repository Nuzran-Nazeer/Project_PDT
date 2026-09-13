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
import MyResultShell from "../pages/shells/MyResultShell";
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
import CyclesPage from "../pages/cycles/CyclesPage";
import CyclePeoplePage from "../pages/cycles/CyclePeoplePage";
import { TABS_BY_GROUP } from "../utils/dashboardTabs";

// The single list of URL to page mappings. Sidebar tabs are generated from
// dashboardTabs.js, so the sidebar can never link somewhere that does not route.
//
// ⚠️ Every gate here HIDES rather than protects. Anyone can call the API directly, so the
// real check is on the server. (Build rule 1)

// `null` means any signed-in user. Entries for groups that render nothing stay, so a group
// added later is gated rather than open by omission.
const GROUP_ACCESS = {
  employee: null,
  supervisor: ["supervisor"],
  hr: ["hr", "head_of_hr"],
  oversight: ["head_of_hr"],
  leadership: ["leadership"],
  admin: ["admin"],
};

// A built tab names its page here; everything else gets the placeholder.
const TAB_PAGES = {
  "my-team": MyTeamPage,
  normalisation: NormalisationPage,

  "my-self-assessment": SelfAssessmentPage,
  "feedback-i-owe": FeedbackOwedPage,
  "my-result": MyResultShell,
};

function AppRoutes() {
  return (
    <Routes>
      {/* Reaching this with a session replaces it silently, which looks like two accounts
          active at once. */}
      <Route element={<SignedOutRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* The one-time code is the credential, so this is deliberately NOT behind
          SignedOutRoute: somebody finishing setup on a borrowed laptop still can. */}
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/status" element={<StatusPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<LandingRedirect />} />

          <Route path="/dashboard" element={<Dashboard />} />

          {Object.entries(TABS_BY_GROUP).map(([group, tabs]) => {
            const allow = GROUP_ACCESS[group];
            // ⚠️ `ownRoute` tabs are SKIPPED: their hand-written routes carry finer gates
            // than a group gate can express, and a generated route would sit before those
            // and quietly narrow them.
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

          {/* Per-role paths, kept as redirects. Each still checks the role first. */}
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

          {/* Drill-downs, not sidebar destinations. The team routes read a self-scoped
              endpoint, so a non-supervisor reaching one by URL finds an empty screen. */}
          <Route path="/my-self-assessment/form" element={<SelfAssessmentFormPage />} />
          {/* A colleague review always belongs to an assignment, so an id-less form has no
              record it could ever save to. */}
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
            {/* ⚠️ The label is the only handle a consumer gets, so it is what addresses
                the record here: the real id never leaves the server. */}
            <Route
              path="/my-team/:id/feedback/:label"
              element={<CollectedResponsePage />}
            />
            <Route path="/my-team/:id/review" element={<SupervisorReviewFormPage />} />
            <Route path="/my-team/:id/normalisation" element={<NormalisationShell />} />
          </Route>

          {/* Reading the roster is wider than changing it, which the server enforces.
              Admin reaches none of it, being a technical account. */}
          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/employees" element={<EmployeeListPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute allow={["hr"]} />}>
            <Route path="/employees/new" element={<EmployeeFormPage />} />
            <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
          </Route>

          {/* ⚠️ An HR officer should reach only units they cover. That needs the coverage
              collection, so every gate here is coarse until it exists. */}
          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/cycles" element={<CyclesPage />} />
            <Route path="/cycles/:id/people" element={<CyclePeoplePage />} />
          </Route>

          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/organisation" element={<OrgTreePage />} />
            {/* Same screen: the unit in the URL makes it linkable and survives a refresh,
                with the tree still beside it. */}
            <Route path="/organisation/:id" element={<OrgTreePage />} />
          </Route>
        </Route>
      </Route>

      {/* Unrecognised paths go back through the landing resolver, which sends a signed out
          visitor to /login and everyone else to their own dashboard. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
