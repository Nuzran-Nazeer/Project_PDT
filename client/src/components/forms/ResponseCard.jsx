import { Link } from "react-router-dom";

export default function ResponseCard({ to, title, summary }) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-line p-4 transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-muted">{summary}</p>
    </Link>
  );
}
