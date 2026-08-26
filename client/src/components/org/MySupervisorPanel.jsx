// Who supervises the signed in person, and why.
//
// THE SCOPE RULE IS THE POINT OF THIS COMPONENT. The criterion is that an employee can
// see their OWN supervisor and cannot look anyone else's up. The panel takes no id,
// and neither does the hook that feeds it: there is no version of the question that
// asks about somebody else. That is the client's half of the rule, and it is the
// smaller half. The refusal lives on the server, which compares the id in the URL
// against the id in the token.
//
// It became presentational when the dashboard started needing the same answer for the
// unit tile. The fetch moved up into hooks/useReportingLine.js so one request serves
// both; nothing about what may be asked changed.
//
// Skip-level is deliberately NOT shown. The server strips it for an employee reading
// their own line, and no criterion puts it in front of one.
export default function MySupervisorPanel({ line, loading, error }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-raised p-5">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-raised p-5">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
        Your supervisor
      </h3>

      {error ? (
        // The server's own words rather than a rewrite.
        //
        // This used to be the normal case: the endpoint was granted to HR, Head of HR
        // and Leadership only, so every employee saw a refusal here. The server grant
        // landed and an employee may now read their own line, so this is a real error
        // path again.
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : !line?.supervisor ? (
        // Both empty answers are real, and they are different from each other, so they
        // say different things. Neither is an error.
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
                ? // Without this the employee sees a name attached to a unit they may
                  // never have heard of, and no way to work out why.
                  `${line.unit.name} has no lead, so this is the lead of ${line.supervisor.leadsUnit?.name || "the unit above"}.`
                : `They lead ${line.unit.name}, which is your unit.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
