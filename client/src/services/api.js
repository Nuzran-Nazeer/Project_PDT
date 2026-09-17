import { clearSession, getToken, SESSION_EXPIRED } from "./token";

// ⚠️ No trailing slash on VITE_API_URL: paths are concatenated and `//` 404s.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function apiFetch(path, options = {}) {
  const token = getToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);

  // ⚠️ Only a 401 on a request that carried a token ends the session: a failed sign-in is a 401 too.
  if (res.status === 401 && token) {
    clearSession();
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }

  if (!res.ok) {
    // ⚠️ The server's own message, never reworded: login hides which of three things went wrong.
    const error = new Error(data?.error || `Request failed: ${res.status}`);
    error.status = res.status;
    error.details = data?.details || null;
    throw error;
  }
  return data;
}

// Drops empty values: an empty filter is a validation error on the server.
export const buildQuery = (filters = {}) => {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString();

  return query ? `?${query}` : "";
};
