import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getMyCurrentCycle } from "../services/cycles";

// The appraisal cycle the signed in person's own group is in, or null.
//
// IT TAKES NO ARGUMENTS, and like the reporting line that is the point. The appraisal
// group is read off their own record on the server, so there is no version of this
// question that asks about anybody else's group. Everyone needs it, because every
// dashboard reports on it, and it carries a period and a stage rather than anything
// about a person.
//
// NULL IS A REAL ANSWER, not a failure. For most of the year a group is between
// cycles, and a draft does not count -- it has not opened, so the group is not in it
// yet. Treating null as an error would report a fault on an ordinary day.
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
