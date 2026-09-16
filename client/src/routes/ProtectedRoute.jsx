import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// ⚠️ This hides, it does not protect: every rule here must also hold on the server.
export default function ProtectedRoute({ allow }) {
  const { isAuthenticated, user, isSupervisor, sessionReady } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allow) {
    // ⚠️ Deciding before the session is ready bounces a supervisor off their own screen on refresh.
    if (!sessionReady) {
      return (
        <p className="p-10 text-center text-muted" role="status">
          Loading…
        </p>
      );
    }

    // `supervisor` is derived and never in `roles`.
    const held = allow.some((role) =>
      role === "supervisor" ? isSupervisor : user?.roles?.includes(role),
    );
    if (!held) return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
