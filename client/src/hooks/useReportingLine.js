import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getReportingLine } from "../services/supervision";

// Takes no id: it reads the session's. The refusal itself lives on the server.
export function useReportingLine() {
  const { user } = useAuth();
  const userId = user?._id;

  const [line, setLine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;

    getReportingLine(userId)
      .then((data) => !cancelled && setLine(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { line, loading, error };
}
