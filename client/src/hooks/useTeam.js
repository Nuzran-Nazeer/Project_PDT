import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getTeam } from "../services/supervision";

// Does not ask at all for somebody who leads nothing: most people do not.
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

  // Derived, not state: setting a flag inside the effect body costs a second render pass.
  const loading = Boolean(isSupervisor) && sessionReady && !team && !error;

  return { team, loading, error };
}
