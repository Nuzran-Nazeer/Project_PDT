import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getReportingLine } from "../services/supervision";

// Takes no id, deliberately: it reads the id out of the session, so there is no
// argument that would let a caller ask about somebody else. That is only the client's
// half of the rule. Hiding the question is not refusing to answer it, and the refusal
// lives on the server, which compares the id in the URL against the id in the token.
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
