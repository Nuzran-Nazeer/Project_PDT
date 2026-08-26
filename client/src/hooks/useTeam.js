import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getTeam } from "../services/supervision";

// The people the signed in person supervises today.
//
// IT TAKES NO ID, for the same reason the reporting line hook takes none: a
// supervisor asks about their own team and nobody else's, so there is no argument
// that would let a caller ask about somebody else. The refusal still lives on the
// server, which compares the id in the URL against the id in the token.
//
// IT DOES NOT ASK AT ALL FOR SOMEBODY WHO LEADS NOTHING. The endpoint would answer
// them perfectly well with an empty team, but most people lead nothing, so that is a
// request on nearly every dashboard load that can only ever come back empty.
// `isSupervisor` is already on the session, derived by the server from who leads a
// unit today, so the answer is known before the question is worth asking.
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

  // Worked out from what is already known rather than held in a third piece of state.
  // Setting a `loading` flag inside the effect body causes a second render pass on
  // every load, which React now warns about, and the answer is derivable anyway: we
  // are waiting exactly when a request was worth making and neither result is in yet.
  const loading = Boolean(isSupervisor) && sessionReady && !team && !error;

  return { team, loading, error };
}
