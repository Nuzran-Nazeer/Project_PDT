import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { landingPathFor } from "../utils/landing";

// "/" renders nothing: it works out which dashboard this user belongs on and sends
// them there.
export default function LandingRedirect() {
  const { user, constants, constantsReady, isSupervisor, sessionReady } = useAuth();

  // Both answers are needed before choosing. The order lives on the server, and so
  // does whether this person leads a unit. Redirecting on either alone sends a
  // supervisor to the employee dashboard and leaves them there.
  if (!constantsReady || !sessionReady) {
    return (
      <p className="p-10 text-center text-muted" role="status">
        Loading…
      </p>
    );
  }

  return (
    <Navigate
      to={landingPathFor(user?.roles, constants?.rolePrecedence, isSupervisor)}
      replace
    />
  );
}
