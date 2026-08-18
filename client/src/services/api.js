// The one place the client knows how to reach the server. Every other service
// file builds its calls on top of this, so the base URL only ever lives here.
const API_BASE_URL = "http://localhost:5000/api";

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data;
}
