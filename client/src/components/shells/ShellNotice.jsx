// ⚠️ "Not built yet", never "Not started". The second is a real answer meaning
// somebody has not begun their work, and showing it here would be a claim about them.
export default function ShellNotice({ children }) {
  return (
    <div className="mb-6 rounded-xl border border-dashed border-line p-5">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
        Not built yet
      </p>
      <p className="mt-2 max-w-prose text-sm text-muted">{children}</p>
    </div>
  );
}
