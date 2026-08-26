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
import EmployeeListPage from "../pages/employees/EmployeeListPage";
import EmployeeDetailPage from "../pages/employees/EmployeeDetailPage";
import EmployeeFormPage from "../pages/employees/EmployeeFormPage";
import OrgTreePage from "../pages/org/OrgTreePage";
import { TABS_BY_GROUP } from "../utils/dashboardTabs";

// The single list of URL to page mappings. Add new routes here only.
//
// THERE IS ONE DASHBOARD, at /dashboard, and it works out its own sections from the
// roles the signed in person holds. It is not gated by role, because everybody has a
// dashboard; what differs is what is on it.
//
// THE SIDEBAR TABS ARE GENERATED, not typed out. Each one is a row in
// utils/dashboardTabs.js, and this file turns every row into a route so the sidebar
// can never offer a link that goes nowhere. A tab whose story has landed names its
// page in TAB_PAGES below; every other one falls through to the honest placeholder.
//
// The six old per role paths are kept as redirects rather than deleted. They are
// still what the landing redirect resolves to after signing in, so removing them
// would mean editing the Log In story's work to land this one.
//
// Every gate here HIDES rather than protects. Anyone can call the API directly and
// skip React entirely, so the real check is on the server, on the endpoints these
// screens call.

// Which roles reach which group's tabs. `null` means any signed in user, which is
// right for the employee tabs because everybody is an employee.
// Entries for groups still held out of the registry are harmless: a group with no
// tabs is never iterated. They stay so a restored group arrives with its gate already
// written rather than open by omission.
const GROUP_ACCESS = {
  employee: null,
  // Not a granted role. It is answered by the server's reading of who leads a unit
  // today, so somebody who stops leading one loses these tabs without anybody editing
  // their account.
  supervisor: ["supervisor"],
  hr: ["hr", "head_of_hr"],
  oversight: ["head_of_hr"],
  leadership: ["leadership"],
  admin: ["admin"],
};

// A tab that has been BUILT names its page here. Everything else falls through to the
// one honest placeholder, which is why adding a screen is a row in the registry plus a
// line here, and never a route written by hand.
const TAB_PAGES = {
  "my-team": MyTeamPage,
};

function AppRoutes() {
  return (
    <Routes>
      {/* Signing in is for people who are not signed in. Reaching this while a
          session exists replaces it silently, which looks like two accounts being
          active at once. */}
      <Route element={<SignedOutRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Public, and it has to be: the person opening it has no account to sign in
          with yet. The one-time code in the link is their credential.

          Deliberately NOT behind SignedOutRoute. The code decides whose account is
          being opened, not whoever happens to be signed in on the machine, so
          somebody finishing their setup on a borrowed laptop still can. */}
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/status" element={<StatusPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Works out the right landing place rather than rendering one. */}
          <Route index element={<LandingRedirect />} />

          <Route path="/dashboard" element={<Dashboard />} />

          {/* One route per sidebar tab, generated from the registry. */}
          {Object.entries(TABS_BY_GROUP).map(([group, tabs]) => {
            const allow = GROUP_ACCESS[group];
            const routes = tabs.map((tab) => {
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

          {/* The old per role dashboard paths. Each still checks the role before
              forwarding, so what a person may reach has not widened. */}
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

          {/* Reading the roster is wider than changing it, which is what the server
              enforces: HR writes, Head of HR and Leadership read. Admin reaches none
              of it, being a technical account with no part in people data.

              These two and the organisation tree belong in the sidebar's HR group per
              the mockups. They are staying in the header until the end of epic patch
              moves them, because they are merged stories' work. */}
          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/employees" element={<EmployeeListPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute allow={["hr"]} />}>
            <Route path="/employees/new" element={<EmployeeFormPage />} />
            <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
          </Route>

          {/* Same three roles as the roster, and the same split inside: only the Head
              of HR shapes the tree, so the page shows its controls to nobody else. One
              route rather than a separate /organisation/new, because a unit is three
              fields and creating one from the tree is the criterion.

              An HR officer is supposed to reach only units they cover, and that check
              does not exist yet: it needs HR coverage, which is assigned later. Every
              gate here is coarse until then. */}
          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/organisation" element={<OrgTreePage />} />
            {/* The same screen. A unit in the URL is what makes it linkable and lets
                it survive a refresh, and the tree stays beside it, which a separate
                route would have cost. */}
            <Route path="/organisation/:id" element={<OrgTreePage />} />
          </Route>
        </Route>
      </Route>

      {/* Anything unrecognised goes back through the landing resolver, which sends a
          signed out visitor to /login and everyone else to their own dashboard. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
