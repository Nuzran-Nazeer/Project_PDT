import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getMyCurrentCycle } from "../services/cycles";

// ⚠️ A null cycle is a real answer, not a failure: for most of the year a group is between cycles.
export function useCurrentCycle() {
  const { user } = useAuth();
  const userId = user?._id;

  const [cycle, setCycle] = useState(null);
  const [parGroup, setParGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;

    getMyCurrentCycle()
      .then((data) => {
        if (cancelled) return;
        setCycle(data?.cycle || null);
        setParGroup(data?.parGroup || null);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { cycle, parGroup, loading, error };
}
