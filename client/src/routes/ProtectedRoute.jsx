import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// Keeps the signed-out away from the app's screens.
//
// ⚠️ This hides, it does not protect. Anyone can call the API directly and skip
// React entirely, so every rule this appears to enforce must also hold on the
// server — which is why the endpoints behind these screens carry their own token
// and role checks. Treat this as navigation, not security. (Build rule 1)
export default function ProtectedRoute({ allow }) {
  const { isAuthenticated, user, isSupervisor, sessionReady } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // `state` remembers where they were headed, so signing in returns them there
    // instead of dumping them on a dashboard they did not ask for.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // `allow` is optional: omitted, the route only needs a signed-in user.
  if (allow) {
    // Wait for the answer before turning anybody away. `supervisor` is not in the
    // stored user, so deciding early sends a supervisor back to the landing page
    // on every refresh of their own screen.
    if (!sessionReady) {
      return (
        <p className="p-10 text-center text-muted" role="status">
          Loading…
        </p>
      );
    }

    // `supervisor` is derived and is never in `roles`, so it is answered by the
    // server's reading of who leads a unit today. Every other name is a granted
    // role and comes off the record.
    const held = allow.some((role) =>
      role === "supervisor" ? isSupervisor : user?.roles?.includes(role),
    );
    if (!held) return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
