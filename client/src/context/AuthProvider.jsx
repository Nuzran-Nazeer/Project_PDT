import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./authContext";
import { login as loginRequest, fetchConstants, fetchMe } from "../services/auth";
import {
  clearSession,
  getStoredUser,
  getToken,
  SESSION_EXPIRED,
  storeSession,
} from "../services/token";

export function AuthProvider({ children }) {
  // `getToken` is passed as the initialiser rather than called: React would otherwise
  // read storage on every render.
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(getStoredUser);

  // Fetched once per session because the endpoint needs a token, so it cannot be
  // loaded before signing in.
  const [constants, setConstants] = useState(null);
  const [constantsReady, setConstantsReady] = useState(false);

  // `supervisor` is not a role anybody is granted: a person is one because they lead a
  // unit today, so only the server can answer it. Working it out here would be a
  // screen deciding what somebody is, which build rule 1 exists to stop.
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [leadsUnits, setLeadsUnits] = useState([]);

  // Guards must not decide before the answer arrives, or a supervisor refreshing on
  // their own screen is bounced off it.
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // No reset branch: clearing state synchronously inside an effect body causes a
    // second render pass and the React lint rule rejects it. The reset belongs in
    // signOut, the only thing that removes a token anyway.
    if (!token) return;

    let cancelled = false;
    fetchConstants()
      .then((data) => !cancelled && setConstants(data))
      // Deliberately swallowed: a failure here must not block signing in. The landing
      // redirect falls back to the employee dashboard, which everyone can reach.
      .catch(() => !cancelled && setConstants(null))
      .finally(() => !cancelled && setConstantsReady(true));

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Re-read on every load rather than trusting what login stored. The token is minted
  // once and never changes, so a role granted this morning is invisible to a session
  // reading only its own copy, and someone who stopped leading a unit keeps seeing a
  // team that is no longer theirs.
  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        storeSession(token, data.user);
        setIsSupervisor(Boolean(data.isSupervisor));
        setLeadsUnits(data.leadsUnits || []);
      })
      // A rejected token is already handled: the API layer clears storage and raises
      // the session-expired event. Anything else leaves the stored copy in place.
      .catch(() => {})
      .finally(() => !cancelled && setSessionReady(true));

    return () => {
      cancelled = true;
    };
  }, [token]);

  const signIn = useCallback(async (identifier, password) => {
    const result = await loginRequest(identifier, password);
    storeSession(result.token, result.user);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  // A client-side discard: the server is not told, because it keeps no session to end
  // (build decision B6). The token stays technically valid until it expires.
  const signOut = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
    setConstants(null);
    setConstantsReady(false);
    setIsSupervisor(false);
    setLeadsUnits([]);
    setSessionReady(false);
  }, []);

  // The API layer clears storage when a token is rejected; this clears the React state
  // to match, so the route guard notices. Without it the two disagree until a reload.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED, signOut);
    return () => window.removeEventListener(SESSION_EXPIRED, signOut);
  }, [signOut]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token),
        constants,
        constantsReady,
        isSupervisor,
        leadsUnits,
        sessionReady,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
