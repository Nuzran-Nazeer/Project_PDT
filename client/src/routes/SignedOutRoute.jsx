import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// The mirror of ProtectedRoute: keeps someone who is ALREADY signed in away from the
// sign-in screen, sending them to the landing resolver instead.
//
// Without it, /login stays reachable from inside the app and a second sign-in quietly
// replaces the first. Nothing breaks — one tab holds one session, so the new one
// overwrites the old — but the screen shows no sign that it happened, which reads as
// two people being signed in at once.
//
// ⚠️ This is navigation, not security, like every guard in this folder. The login
// endpoint is public and always will be: anyone can post credentials to it directly,
// which is what signing in IS. What this fixes is the interface offering a door that
// should not be there when you are already inside. (Build rule 1)
export default function SignedOutRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/" replace />;

  return <Outlet />;
}
