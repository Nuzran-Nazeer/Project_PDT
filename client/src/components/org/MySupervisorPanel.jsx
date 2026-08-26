import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getReportingLine } from "../../services/supervision";

// The one thing on the employee dashboard that is true today.
//
// THE SCOPE RULE IS THE POINT OF THIS COMPONENT. The criterion is that an employee
// can see their OWN supervisor and cannot look anyone else's up, so this takes no id
// — it reads the signed-in user's id and there is no way to ask it about anybody
// else. That is the client's half of the rule, and it is the smaller half: hiding
// the question is not the same as refusing to answer it, and the refusal has to live
// on the server or anyone can call the endpoint directly.
//
// Skip-level is deliberately NOT shown. The endpoint returns it, and no criterion
// puts it in front of an employee.

export default function MySupervisorPanel() {
  const { user } = useAuth();
  const userId = user?._id;

  const [line, setLine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;

    getReportingLine(userId)
      .then((data) => !cancelled && setLine(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-8 rounded-xl border border-line bg-raised p-5">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-line bg-raised p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
        Your supervisor
      </h2>

      {error ? (
        // The server's own words rather than a rewrite. Until the grant is widened
        // this is a permission refusal on every employee's dashboard, which is the
        // known state described in the service file.
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : !line?.supervisor ? (
        // Both empty answers are real, and they are different from each other, so
        // they say different things. Neither is an error.
        <p className="mt-2 text-sm text-muted">
          {line?.unit
            ? `Nobody leads ${line.unit.name}, and no unit above it has a lead either, so you have no supervisor at the moment.`
            : "You are not in a unit yet, so nobody supervises you and you are not part of an appraisal."}
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink">{line.supervisor.name}</p>

          {line.unit && (
            <p className="mt-1 text-[13px] text-muted">
              {line.resolvedUpward
                ? // Without this the employee sees a name attached to a unit they
                  // may never have heard of, and no way to work out why.
                  `${line.unit.name} has no lead, so this is the lead of ${line.supervisor.leadsUnit?.name || "the unit above"}.`
                : `They lead ${line.unit.name}, which is your unit.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
