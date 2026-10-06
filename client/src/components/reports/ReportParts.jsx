import { percent } from "../../utils/reportScale";

const selectClass =
  "rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function CycleSelect({ cycles, value, onChange }) {
  if (!cycles?.length) return null;

  return (
    <div className="mb-6 flex items-center gap-3">
      <label htmlFor="cycle" className="text-sm text-muted">
        Cycle
      </label>
      <select
        id="cycle"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        {cycles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ⚠️ Shown, never left out: a missing group reads as "nothing happened" and this one did.
export function SuppressedCard({ name, floor }) {
  return (
    <section className="rounded-xl border border-dashed border-line p-5">
      <h2 className="font-medium text-ink">{name}</h2>
      <p className="mt-1 text-sm text-muted">
        Fewer than {floor} people, so this group is too small to report without
        identifying someone.
      </p>
    </section>
  );
}

// A stacked bar with a 2px gap between segments, and a legend that carries every count so
// nothing is read from colour alone.
export function SegmentBar({ segments, label }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded"
        role="img"
        aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.count}`).join(", ")}`}
      >
        {total === 0 ? (
          <div className="h-full w-full rounded bg-line" />
        ) : (
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.label}
                title={`${s.label}: ${s.count} (${percent(s.count, total)}%)`}
                className={`h-full first:rounded-l last:rounded-r ${s.className}`}
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            ))
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.className}`} />
            <span className="text-ink">{s.label}</span>
            <span>
              {s.count} · {percent(s.count, total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Notice({ tone = "muted", children }) {
  return (
    <p
      role={tone === "danger" ? "alert" : undefined}
      className={`rounded-xl border border-line bg-raised p-5 text-sm ${
        tone === "danger" ? "text-danger" : "text-muted"
      }`}
    >
      {children}
    </p>
  );
}
