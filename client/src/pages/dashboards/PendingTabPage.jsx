import { useAuth } from "../../hooks/useAuth";
import PageHeader from "../../components/layout/PageHeader";

// Every tab with a place in the design and no data behind it yet. One page serves all
// of them, driven by the registry entry the router hands it.
//
// It says "not built" in those words on purpose. "Nothing to show" is a real answer
// meaning you have no colleague reviews this cycle, and showing the second as the
// first tells somebody something false about their own appraisal.
export default function PendingTabPage({ tab }) {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title={tab.title}
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <div className="rounded-xl border border-dashed border-line p-10 text-center">
        <p className="text-ink">{tab.description}</p>
        <p className="mx-auto mt-3 max-w-prose text-sm text-muted">
          Not built yet. This screen has a place in the design and a route that works,
          and the data behind it does not exist on the server.
        </p>
      </div>
    </>
  );
}
