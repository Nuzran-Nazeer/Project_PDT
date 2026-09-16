import { Link } from "react-router-dom";
import Icon from "../common/Icon";

export default function PageHeader({ title, context, backTo }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>

      {context && <p className="mt-2 text-sm text-muted">{context}</p>}

      {backTo && (
        <Link
          to={backTo}
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-brand"
        >
          <Icon name="arrowLeft" className="h-4 w-4" />
          Back to dashboard
        </Link>
      )}
    </header>
  );
}
