import { Link } from "react-router-dom";

export default function ResponseCard({ to, title, summary }) {
  return (
    <Link
      to={to}
      className="block rounded-xl border border-line bg-secondary/40 p-4 transition-colors hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-muted">{summary}</p>
    </Link>
  );
}
