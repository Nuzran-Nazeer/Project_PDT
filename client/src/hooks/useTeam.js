import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getTeam } from "../services/supervision";

// Takes no id, for the same reason useReportingLine takes none. The refusal lives on
// the server, which compares the id in the URL against the id in the token.
//
// It does not ask at all for somebody who leads nothing. The endpoint would answer
// with an empty team, but most people lead nothing, so that is a request on nearly
// every dashboard load that can only come back empty.
export function useTeam() {
  const { user, isSupervisor, sessionReady } = useAuth();
  const userId = user?._id;

  const [team, setTeam] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionReady || !isSupervisor || !userId) return undefined;

    let cancelled = false;

    getTeam(userId)
      .then((data) => !cancelled && setTeam(data))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [userId, isSupervisor, sessionReady]);

  // Derived rather than held in state: setting a `loading` flag inside the effect
  // body causes a second render pass on every load, which React warns about.
  const loading = Boolean(isSupervisor) && sessionReady && !team && !error;

  return { team, loading, error };
}
