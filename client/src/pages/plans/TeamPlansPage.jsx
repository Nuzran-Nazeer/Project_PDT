import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getTeamPlans, startPlan } from "../../services/plans";
import PageHeader from "../../components/layout/PageHeader";
import { formatDate } from "../../utils/dates";
import { planStateLabel, PLAN_STATE_TONE } from "../../utils/planLabels";

// ⚠️ Everyone supervised today whose review is published, and nobody else. Somebody
// supervised last year and not now is absent because the list is built from today's team.
export default function TeamPlansPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState("");

  useEffect(() => {
    let cancelled = false;

    getTeamPlans()
      .then((data) => !cancelled && setPeople(data.people))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, []);

  // Starting a plan twice on one review opens the plan already there, so this is safe to
  // press again after a failed request.
  const open = async (person) => {
    if (person.planId) {
      navigate(`/team-plans/${person.planId}`);
      return;
    }

    setStarting(person.id);
    setError("");

    try {
      const plan = await startPlan(person.reviewId);
      navigate(`/team-plans/${plan.id}`);
    } catch (err) {
      setError(err.message);
      setStarting("");
    }
  };

  return (
    <>
      <PageHeader
        title="Team development plans"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <p className="mb-6 max-w-prose text-sm text-muted">
        A development plan turns a published review into work. Each action is tied to a
        competency the review highlighted, which the employee never sees.
      </p>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {!people ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      ) : people.length === 0 ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Nobody you supervise has a published review yet, so there is no plan to write.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <Th>Name</Th>
                <Th>Employee ID</Th>
                <Th>Unit</Th>
                <Th>Review published</Th>
                <Th>Plan</Th>
                <Th>Actions</Th>
                <Th> </Th>
              </tr>
            </thead>

            <tbody>
              {people.map((person) => (
                <tr key={person.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{person.name}</td>
                  <td className="px-4 py-3 text-muted">{person.employeeId}</td>
                  <td className="px-4 py-3 text-muted">
                    {person.unit?.name || "No unit"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(person.publishedAt)}
                  </td>
                  <td className={`px-4 py-3 ${PLAN_STATE_TONE[person.state]}`}>
                    {planStateLabel(person.state)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {person.state === "owed" ? "—" : person.actionCount}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => open(person)}
                      disabled={starting === person.id}
                      className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:bg-surface disabled:opacity-60"
                    >
                      {starting === person.id
                        ? "Opening…"
                        : person.state === "owed"
                          ? "Start a plan"
                          : "Open"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </th>
  );
}
