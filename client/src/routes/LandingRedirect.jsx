import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { landingPathFor } from "../utils/landing";

export default function LandingRedirect() {
  const { user, constants, constantsReady, isSupervisor, sessionReady } = useAuth();

  // ⚠️ Both answers are needed: redirecting on either alone strands a supervisor on the
  // employee dashboard.
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
