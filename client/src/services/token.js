// The one place that knows where the session token is kept.
//
// `sessionStorage`, not `localStorage`: the token dies when the tab closes, which
// is what "signing out ends the session" should mean by default. It still survives
// a refresh, so reloading a page does not throw you back to the login screen.
//
// Neither store is safe from a cross-site scripting bug — anything that can run
// JavaScript on the page can read both. The genuinely secure option is an
// httpOnly cookie, which the browser will not hand to JavaScript at all, and that
// is a SERVER change: the token would have to be set as a cookie at login and read
// from one on every request. Recorded as build decision B8 rather than left as an
// accident of whichever line got typed first.
const TOKEN_KEY = "pdt-token";
const USER_KEY = "pdt-user";

// Raised when the server rejects a token we actually sent — it has expired, or it
// was signed with a secret the server no longer uses.
//
// A window event rather than a direct call, because the API layer must not import
// the auth context: the context already imports the API layer, and the two would
// form a cycle. This lets the provider listen without either side knowing about
// the other.
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
