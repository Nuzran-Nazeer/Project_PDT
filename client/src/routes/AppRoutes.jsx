import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import LandingRedirect from "./LandingRedirect";
import SignedOutRoute from "./SignedOutRoute";
import LoginPage from "../pages/LoginPage";
import ActivatePage from "../pages/ActivatePage";
import StatusPage from "../pages/StatusPage";
import EmployeeDashboard from "../pages/dashboards/EmployeeDashboard";
import HrDashboard from "../pages/dashboards/HrDashboard";
import HeadOfHrDashboard from "../pages/dashboards/HeadOfHrDashboard";
import LeadershipDashboard from "../pages/dashboards/LeadershipDashboard";
import AdminDashboard from "../pages/dashboards/AdminDashboard";
import SupervisorDashboard from "../pages/dashboards/SupervisorDashboard";
import EmployeeListPage from "../pages/employees/EmployeeListPage";
import EmployeeDetailPage from "../pages/employees/EmployeeDetailPage";
import EmployeeFormPage from "../pages/employees/EmployeeFormPage";

// The single list of URL -> page mappings. Add new routes here only.
//
// Each dashboard is gated to its own role. That gate HIDES rather than protects —
// the real check is on the server, on the endpoints these screens will call.
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
          being opened, not whoever happens to be signed in on the machine — so
          somebody finishing their setup on a borrowed laptop still can. */}
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/status" element={<StatusPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Works out the right dashboard rather than rendering one. */}
          <Route index element={<LandingRedirect />} />

          <Route element={<ProtectedRoute allow={["employee"]} />}>
            <Route path="/employee" element={<EmployeeDashboard />} />
          </Route>
          <Route element={<ProtectedRoute allow={["hr"]} />}>
            <Route path="/hr" element={<HrDashboard />} />
          </Route>
          <Route element={<ProtectedRoute allow={["head_of_hr"]} />}>
            <Route path="/head-of-hr" element={<HeadOfHrDashboard />} />
          </Route>
          <Route element={<ProtectedRoute allow={["leadership"]} />}>
            <Route path="/leadership" element={<LeadershipDashboard />} />
          </Route>
          <Route element={<ProtectedRoute allow={["admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
          {/* Reading the roster is wider than changing it, which is what the
              server enforces: HR writes, Head of HR and Leadership read. Admin
              reaches none of it — it is a technical account with no part in
              people-data. */}
          <Route element={<ProtectedRoute allow={["hr", "head_of_hr", "leadership"]} />}>
            <Route path="/employees" element={<EmployeeListPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute allow={["hr"]} />}>
            <Route path="/employees/new" element={<EmployeeFormPage />} />
            <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
          </Route>

          {/* Unreachable until the org structure exists — `supervisor` is derived
              from unit leadership and is deliberately not in the token. */}
          <Route element={<ProtectedRoute allow={["supervisor"]} />}>
            <Route path="/supervisor" element={<SupervisorDashboard />} />
          </Route>
        </Route>
      </Route>

      {/* Anything unrecognised goes back through the landing resolver, which
          sends a signed-out visitor to /login and everyone else to their own
          dashboard. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
