import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// Keeps someone already signed in away from the sign-in screen, where a second
// sign-in would quietly replace the first with nothing on screen to show it.
//
// ⚠️ Navigation, not security. The login endpoint is public and always will be.
// (Build rule 1)
export default function SignedOutRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/" replace />;

  return <Outlet />;
}
