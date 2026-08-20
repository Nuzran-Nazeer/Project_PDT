import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// Keeps the signed-out away from the app's screens.
//
// ⚠️ This hides, it does not protect. Anyone can call the API directly and skip
// React entirely, so every rule this appears to enforce must also hold on the
// server — which is why the endpoints behind these screens carry their own token
// and role checks. Treat this as navigation, not security. (Build rule 1)
export default function ProtectedRoute({ allow }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // `state` remembers where they were headed, so signing in returns them there
    // instead of dumping them on a dashboard they did not ask for.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // `allow` is optional: omitted, the route only needs a signed-in user.
  if (allow && !allow.some((role) => user?.roles?.includes(role))) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
