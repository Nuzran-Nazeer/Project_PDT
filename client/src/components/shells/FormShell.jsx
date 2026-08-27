import { Link } from "react-router-dom";

// The frame all four review forms share: lettered sections, draft and submit at the end.

export function FormShell({ children }) {
  return <div className="grid gap-5">{children}</div>;
}

// The walkthrough labels sections A to D and refers to them that way.
export function FormSection({ letter, title, note, children }) {
  return (
    <section className="rounded-xl border border-line bg-raised p-5">
      <h2 className="text-[15px] font-semibold text-ink">
        {letter && <span className="mr-2 text-muted">{letter}</span>}
        {title}
      </h2>

      {note && <p className="mt-1.5 max-w-prose text-[13px] text-muted">{note}</p>}

      <div className="mt-4">{children}</div>
    </section>
  );
}

// ⚠️ Both controls disabled, not silent. A live-looking button that discards what
// somebody typed is worse than no button.
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
        Both controls are disabled: nothing on this form is stored yet. When they work, a
        draft stays private to you, and a submitted form can still be corrected for{" "}
        <strong>five hours</strong> before it locks.
      </p>
    </div>
  );
}
