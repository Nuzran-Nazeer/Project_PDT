import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./authContext";
import { login as loginRequest, fetchConstants } from "../services/auth";
import {
  clearSession,
  getStoredUser,
  getToken,
  SESSION_EXPIRED,
  storeSession,
} from "../services/token";

export function AuthProvider({ children }) {
  // Seeded from storage so a refresh does not drop the session. `getToken` is
  // passed as the initialiser rather than called — React would otherwise read
  // storage on every single render.
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(getStoredUser);

  // The controlled lists, including the role order that decides where a
  // multi-role user lands. Fetched once per session because the endpoint needs a
  // token, so it cannot be loaded before signing in.
  //
  // It lives here for now because the landing redirect is its only consumer.
  // When the employee-record forms need the designation list too, this is worth
  // splitting into its own provider rather than growing this one.
  const [constants, setConstants] = useState(null);
  const [constantsReady, setConstantsReady] = useState(false);

  useEffect(() => {
    // No reset branch here: clearing state synchronously inside an effect body
    // causes a second render pass, and the React lint rule rejects it. The reset
    // belongs in signOut, which is the only thing that removes a token anyway.
    if (!token) return;

    let cancelled = false;
    fetchConstants()
      .then((data) => !cancelled && setConstants(data))
      // Deliberately swallowed. A failure here must not block signing in — the
      // landing redirect falls back to the employee dashboard, which everyone
      // can reach, rather than stranding the user on a spinner.
      .catch(() => !cancelled && setConstants(null))
      .finally(() => !cancelled && setConstantsReady(true));

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

  // Signing out is a client-side discard: the token is thrown away and the
  // server is not told, because it keeps no session to end (build decision B6).
  // The token itself stays technically valid until it expires.
  const signOut = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
    setConstants(null);
    setConstantsReady(false);
  }, []);

  // The API layer clears storage when a token is rejected; this is what clears the
  // React state to match, so the route guard notices and sends the user to login.
  // Without it the two disagree until something forces a reload.
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
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
