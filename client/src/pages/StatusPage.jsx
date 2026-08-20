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
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-ink">
        Performance &amp; Development Tracker
      </h2>
      <p className="mt-2 max-w-prose leading-relaxed text-muted">
        A platform built to manage appraisal (PAR) cycles, gather 360° feedback, and track
        employee growth plans.
      </p>

      {/* System Status Section */}
      <h3 className="mt-8 text-lg font-semibold text-ink">System Status</h3>
      {error && <p className="mt-2 text-danger">Backend error: {error}</p>}
      {!status && !error && <p className="mt-2 text-muted">Checking…</p>}
      {status && (
        <ul className="mt-2 space-y-1 text-ink">
          <li>Server: {status.server}</li>
          <li>
            Database:{" "}
            <strong
              className={status.database === "connected" ? "text-success" : "text-danger"}
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
