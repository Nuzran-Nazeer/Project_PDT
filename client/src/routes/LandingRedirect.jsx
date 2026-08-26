import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { landingPathFor } from "../utils/landing";

// "/" does not render anything — it works out which dashboard this user belongs
// on and sends them there. Criterion 6 of "Log in".
//
// It waits for the constants request because the ORDER lives on the server. The
// wait is one request on the first load of a session, and it is the price of not
// keeping a second copy of that order in the client.
export default function LandingRedirect() {
  const { user, constants, constantsReady, isSupervisor, sessionReady } = useAuth();

  // Both answers are needed before choosing: the order comes from the server,
  // and whether this person leads a unit does too. Redirecting on either alone
  // sends a supervisor to the employee dashboard and then leaves them there.
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
