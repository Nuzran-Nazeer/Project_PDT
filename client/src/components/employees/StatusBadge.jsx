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
