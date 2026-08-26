import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getReportingLine } from "../services/supervision";

// The signed in person's own reporting line: their unit on a date, who supervises
// them, and whether that answer had to resolve upward to a parent unit.
//
// IT TAKES NO ID, AND THAT IS THE POINT. The criterion is that an employee may see
// their OWN supervisor and cannot look anybody else's up, so this reads the id out of
// the session and there is no argument that would let a caller ask about somebody
// else. That is the client's half of the rule and it is the smaller half: hiding the
// question is not the same as refusing to answer it, and the refusal lives on the
// server, which compares the id in the URL against the id in the token.
//
// It is a hook rather than a fetch inside the panel because two things now want the
// answer: the panel that names the supervisor, and the dashboard tile that names the
// unit. Fetching it twice would be two requests for one answer.
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
