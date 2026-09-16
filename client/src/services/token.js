// `sessionStorage`, not `localStorage`: the token dies with the tab but survives a refresh (B8).
const TOKEN_KEY = "pdt-token";
const USER_KEY = "pdt-user";

// A window event: the API layer importing the auth context would be a cycle.
export const SESSION_EXPIRED = "pdt:session-expired";

const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const getToken = () => safe(() => sessionStorage.getItem(TOKEN_KEY));

export const getStoredUser = () =>
  safe(() => {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

export const storeSession = (token, user) =>
  safe(() => {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  });

export const clearSession = () =>
  safe(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  });
