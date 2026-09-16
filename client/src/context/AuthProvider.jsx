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
  // Passed as the initialiser, not called: React would otherwise read storage on every render.
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(getStoredUser);

  const [constants, setConstants] = useState(null);
  const [constantsReady, setConstantsReady] = useState(false);

  // `supervisor` is derived, so only the server can answer it.
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [leadsUnits, setLeadsUnits] = useState([]);

  // Guards must not decide before the answer arrives.
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // No reset branch: the reset belongs in signOut, and state set in an effect body re-renders.
    if (!token) return;

    let cancelled = false;
    fetchConstants()
      .then((data) => !cancelled && setConstants(data))
      // Swallowed: a failure here must not block signing in.
      .catch(() => !cancelled && setConstants(null))
      .finally(() => !cancelled && setConstantsReady(true));

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Re-read on every load: the token never changes, so a role granted today would be invisible.
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
      // A rejected token is already handled by the API layer.
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

  // Client-side only: the server keeps no session to end (B6).
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

  // Mirrors the API layer clearing storage, so the route guard notices.
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
