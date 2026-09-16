// Skip-level is not shown: the server strips it for an employee reading their own line.
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
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : !line?.supervisor ? (
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
                ? `${line.unit.name} has no lead, so this is the lead of ${line.supervisor.leadsUnit?.name || "the unit above"}.`
                : `They lead ${line.unit.name}, which is your unit.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
