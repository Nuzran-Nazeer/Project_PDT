// The card, heading, three columns and status pill the mockups draw every list as.
// Takes rows already built by the page, so nothing about the appraisal is known here.
export default function ShellTable({ heading, columns, rows, empty }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-raised">
      {heading && (
        <h2 className="px-5 pt-5 text-[15px] font-semibold text-ink">{heading}</h2>
      )}

      {rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-line last:border-0">
                {row.cells.map((cell, at) => (
                  <td
                    key={at}
                    className={`px-5 py-3.5 ${at === 0 ? "font-medium text-ink" : "text-muted"}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ⚠️ One tone only. The mockups' green "Submitted" and amber "Draft" are states of
// real work, and a shell has none to report.
export function Pill({ children }) {
  return (
    <span className="inline-block rounded-lg border border-line px-2.5 py-1 text-[12px] text-muted">
      {children}
    </span>
  );
}
