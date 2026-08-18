import { useEffect, useState } from "react";
import { apiFetch } from "../services/api";

function StatusPage() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/status")
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h2>Performance & Development Tracker</h2>
      <p style={{ color: "#666", lineHeight: "1.5" }}>
        A platform built to manage appraisal (PAR) cycles, gather 360° feedback,
        and track employee growth plans.
      </p>

      {/* System Status Section */}
      <h3>System Status</h3>
      {error && <p style={{ color: "red" }}>Backend error: {error}</p>}
      {!status && !error && <p>Checking…</p>}
      {status && (
        <ul>
          <li>Server: {status.server}</li>
          <li>
            Database:{" "}
            <strong
              style={{
                color: status.database === "connected" ? "green" : "red",
              }}
            >
              {status.database}
            </strong>
          </li>
          <li>DB name: {status.dbName || "—"}</li>
        </ul>
      )}
    </div>
  );
}

export default StatusPage;
