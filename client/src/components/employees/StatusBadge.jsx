// The three account states, said in words rather than a colour alone.
//
// `invited` is the one worth spelling out: it means a record exists that nobody can
// sign in to yet, which is a job for HR rather than a neutral state.
const LABELS = {
  active: { text: "Active", className: "border-success/40 bg-success/10 text-success" },
  invited: {
    text: "Awaiting activation",
    className: "border-brand/40 bg-brand/10 text-brand",
  },
  inactive: { text: "Deactivated", className: "border-line bg-surface text-muted" },
};

export default function StatusBadge({ status }) {
  const style = LABELS[status] || {
    text: status || "Unknown",
    className: "border-line bg-surface text-muted",
  };

  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-[12px] font-medium ${style.className}`}
    >
      {style.text}
    </span>
  );
}
