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
import SelfAssessmentShell from "../pages/shells/SelfAssessmentShell";
import FeedbackOwedShell from "../pages/shells/FeedbackOwedShell";
import MyResultShell from "../pages/shells/MyResultShell";
import SelfAssessmentFormShell from "../pages/shells/SelfAssessmentFormShell";
import PeerReviewFormShell from "../pages/shells/PeerReviewFormShell";
import TeamMemberShell from "../pages/shells/TeamMemberShell";
import SupervisorReviewFormShell from "../pages/shells/SupervisorReviewFormShell";
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
// ⚠️ Every gate here HIDES rather than protects. Anyone can call the API directly, so
// the real check is on the server. (Build rule 1)

// `null` means any signed-in user. Entries for groups that render nothing stay, so a
// group added later is gated rather than open by omission.
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

  "my-self-assessment": SelfAssessmentShell,
  "feedback-i-owe": FeedbackOwedShell,
  "my-result": MyResultShell,
};

function AppRoutes() {
  return (
    <Routes>
      {/* Reaching this with a session replaces it silently, which looks like two
          accounts active at once. */}
      <Route element={<SignedOutRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Public: the one-time code is the credential. Deliberately NOT behind
          SignedOutRoute, so somebody finishing setup on a borrowed laptop still can. */}
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/status" element={<StatusPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<LandingRedirect />} />

          <Route path="/dashboard" element={<Dashboard />} />

          {Object.entries(TABS_BY_GROUP).map(([group, tabs]) => {
            const allow = GROUP_ACCESS[group];
            // ⚠️ `ownRoute` tabs are SKIPPED: they have hand-written routes with finer
            // gates than a group gate can express, and a generated route would sit
            // before those and quietly narrow them. See dashboardTabs.js.
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

          {/* Drill-downs, not sidebar destinations, so they are written by hand. The
              team routes read a self-scoped endpoint, so a non-supervisor reaching one
              by URL finds an empty screen, not somebody else's data. */}
          <Route path="/my-self-assessment/form" element={<SelfAssessmentFormShell />} />
          <Route path="/feedback-i-owe/form" element={<PeerReviewFormShell />} />
          <Route path="/feedback-i-owe/:id" element={<PeerReviewFormShell />} />

          <Route element={<ProtectedRoute allow={["supervisor"]} />}>
            <Route path="/my-team/:id" element={<TeamMemberShell />} />
            <Route path="/my-team/:id/review" element={<SupervisorReviewFormShell />} />
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

          {/* Same three roles as the roster, with the same split inside: only the
              Head of HR shapes the tree.

              ⚠️ An HR officer should reach only units they cover. That needs the
              coverage collection, so every gate here is coarse until it exists. */}
          {/* HR and the Head of HR move a cycle, Leadership reads it. The page draws
              no controls for a reader, and the server refuses them regardless. */}
          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/cycles" element={<CyclesPage />} />
            {/* The cycle is in the URL so the page can be linked to. */}
            <Route path="/cycles/:id/people" element={<CyclePeoplePage />} />
          </Route>

          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/organisation" element={<OrgTreePage />} />
            {/* Same screen: the unit in the URL makes it linkable and survives a
                refresh, with the tree still beside it. */}
            <Route path="/organisation/:id" element={<OrgTreePage />} />
          </Route>
        </Route>
      </Route>

      {/* Unrecognised paths go back through the landing resolver, which sends a
          signed out visitor to /login and everyone else to their own dashboard. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
