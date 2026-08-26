import { Link } from "react-router-dom";
import Icon from "../common/Icon";

// The top of every screen inside the app frame: a title, a line of context under it,
// and a way back to the dashboard on any screen that is not the dashboard.
//
// It exists so the thirty screens the design calls for all open the same way. Written
// per page, the fourth one drifts and nobody notices until they are side by side.
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
