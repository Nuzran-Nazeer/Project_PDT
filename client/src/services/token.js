// `sessionStorage`, not `localStorage`: the token dies when the tab closes but still
// survives a refresh. Neither store is safe from a cross-site scripting bug; the
// secure option is an httpOnly cookie, which is a server change. (Build decision B8)
const TOKEN_KEY = "pdt-token";
const USER_KEY = "pdt-user";

// A window event rather than a direct call: the API layer must not import the auth
// context, which already imports the API layer, so the two would form a cycle.
export const SESSION_EXPIRED = "pdt:session-expired";

const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback; // storage blocked: private mode, cookies disabled
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
