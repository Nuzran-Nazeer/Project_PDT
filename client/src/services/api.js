import { clearSession, getToken, SESSION_EXPIRED } from "./token";

// The one place the client knows how to reach the server. Every other service
// file builds its calls on top of this, so the base URL only ever lives here.
//
// Set VITE_API_URL in client/.env to point somewhere other than your own
// machine. The fallback keeps `npm run dev` working with no setup at all.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function apiFetch(path, options = {}) {
  const token = getToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // Attached here, once, rather than by each caller. A protected endpoint
      // called without it fails with a 401 that reads like a login problem, and
      // the sixth person to add a service file is the one who forgets.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);

  // A 401 on a request that CARRIED a token means the token is no longer good —
  // expired, most likely, since they last a day. Without this the user sits on a
  // dashboard that cannot load anything, still "signed in" as far as the client is
  // concerned, with no way back to the login screen but typing the URL.
  //
  // The `token` check matters: a failed sign-in is also a 401, and there is no
  // session to end in that case.
  if (res.status === 401 && token) {
    clearSession();
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }

  if (!res.ok) {
    // The server's own message, not one invented here. For login that matters:
    // it deliberately says the same thing for a wrong password, an unknown
    // account and a disabled one, and rewording it client-side would leak the
    // difference the server went to trouble to hide.
    const error = new Error(data?.error || `Request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}
