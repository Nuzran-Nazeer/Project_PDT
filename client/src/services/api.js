import { clearSession, getToken, SESSION_EXPIRED } from "./token";

// Set VITE_API_URL in client/.env to point somewhere other than your own machine.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function apiFetch(path, options = {}) {
  const token = getToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // Attached here once rather than by each caller: a protected endpoint called
      // without it fails with a 401 that reads like a login problem.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);

  // A 401 on a request that CARRIED a token means the token is no longer good.
  // Without this the user sits on a dashboard that loads nothing, still "signed in".
  // The `token` check matters: a failed sign-in is also a 401, with no session to end.
  if (res.status === 401 && token) {
    clearSession();
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }

  if (!res.ok) {
    // The server's own message, never one invented here. Login deliberately says the
    // same thing for a wrong password, an unknown account and a disabled one, so
    // rewording it client-side leaks the difference the server hides.
    const error = new Error(data?.error || `Request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

// Drops empty values so `?unitId=&on=` never reaches the server, where an empty
// filter is a validation error rather than "no filter".
export const buildQuery = (filters = {}) => {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString();

  return query ? `?${query}` : "";
};
