import { useAuth } from "../../hooks/useAuth";
import PageHeader from "../../components/layout/PageHeader";

// ⚠️ "Not built yet", never "Nothing to show": the second is a real answer about somebody's appraisal.
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
