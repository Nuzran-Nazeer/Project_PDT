import { useAuth } from "../../hooks/useAuth";
import PageHeader from "../../components/layout/PageHeader";

// Every tab with a place in the design and no data behind it. One page serves all of
// them, from the registry entry the router hands it.
//
// ⚠️ "Not built yet", never "Nothing to show". The second is a real answer meaning you
// have no colleague reviews this cycle, and showing it here says something false about
// somebody's own appraisal.
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
        <p className="mx-auto mt-3 text-sm text-muted">Not built yet.</p>
      </div>
    </>
  );
}
