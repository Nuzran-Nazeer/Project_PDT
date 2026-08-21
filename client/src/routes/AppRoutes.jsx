import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import LandingRedirect from "./LandingRedirect";
import LoginPage from "../pages/LoginPage";
import StatusPage from "../pages/StatusPage";
import EmployeeDashboard from "../pages/dashboards/EmployeeDashboard";
import HrDashboard from "../pages/dashboards/HrDashboard";
import HeadOfHrDashboard from "../pages/dashboards/HeadOfHrDashboard";
import LeadershipDashboard from "../pages/dashboards/LeadershipDashboard";
import AdminDashboard from "../pages/dashboards/AdminDashboard";
import SupervisorDashboard from "../pages/dashboards/SupervisorDashboard";

// The single list of URL -> page mappings. Add new routes here only.
//
// Each dashboard is gated to its own role. That gate HIDES rather than protects —
// the real check is on the server, on the endpoints these screens will call.
function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
