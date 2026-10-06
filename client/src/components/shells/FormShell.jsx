import { Link } from "react-router-dom";

export function FormShell({ children }) {
  return <div className="grid gap-5">{children}</div>;
}

export function FormSection({ letter, title, note, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-raised">
      <div className="border-b border-line px-5 py-5 sm:px-6">
        <h2 className="text-base font-semibold text-ink">
          {letter && <span className="mr-2 text-muted">{letter}</span>}
          {title}
        </h2>

        {note && <p className="mt-1.5 max-w-prose text-[13px] text-muted">{note}</p>}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

// ⚠️ Both controls disabled, not silent: a live-looking button that discards typing is worse than none.
export function FormActions({ backTo, backLabel }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted opacity-60"
        >
          Save as draft
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white opacity-50"
        >
          Submit
        </button>

        {backTo && (
          <Link
            to={backTo}
            className="text-sm text-muted transition-colors hover:text-brand"
          >
            {backLabel || "Back"}
          </Link>
        )}
      </div>

      <p className="mt-3 max-w-prose text-[13px] text-muted">
        Not built yet. Nothing on this form is stored.
      </p>
    </div>
  );
}
