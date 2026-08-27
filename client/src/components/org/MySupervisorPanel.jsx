// Presentational. The panel takes no id and neither does the hook feeding it, so
// there is no version of the question that asks about somebody else. That is the
// client's half of the rule; the refusal lives on the server, which compares the id in
// the URL against the id in the token.
//
// Skip-level is deliberately not shown: the server strips it for an employee reading
// their own line.
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
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : !line?.supervisor ? (
        // Both empty answers are real and mean different things. Neither is an error.
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
