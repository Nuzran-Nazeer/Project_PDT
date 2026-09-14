import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import { listCycles } from "../../services/cycles";
import { getCycleLists } from "../../services/reviewerLists";
import { stateLabel } from "../../utils/reviewerListStates";

// Lists exist from collecting onwards. Later stages stay selectable because a cycle may move
// on with lists undrawn, and this is where that count is seen.
const HAS_LISTS = [
  "collecting",
  "supervisor_review",
  "normalising",
  "published",
  "closed",
];

const pendingIn = (group) => group.people.reduce((sum, p) => sum + p.pendingChanges, 0);

export default function ChooseReviewersPage() {
  const [cycles, setCycles] = useState(null);
  const [cycleError, setCycleError] = useState("");
  const [chosenId, setChosenId] = useState("");

  const [result, setResult] = useState(null);
  const [listError, setListError] = useState({ cycleId: "", message: "" });

  useEffect(() => {
    let cancelled = false;
    listCycles()
      .then((data) => {
        if (cancelled) return;
        setCycles((data.items || []).filter((c) => HAS_LISTS.includes(c.status)));
      })
      .catch((err) => !cancelled && setCycleError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const cycleId =
    chosenId ||
    cycles?.find((c) => c.status === "collecting")?._id ||
    cycles?.[0]?._id ||
    "";

  useEffect(() => {
    if (!cycleId) return undefined;
    let cancelled = false;
    getCycleLists(cycleId)
      .then((data) => !cancelled && setResult({ cycleId, data }))
      .catch((err) => !cancelled && setListError({ cycleId, message: err.message }));
    return () => {
      cancelled = true;
    };
  }, [cycleId]);

  const data = result?.cycleId === cycleId ? result.data : null;
  const error = listError.cycleId === cycleId ? listError.message : "";

  const groups = [...(data?.groups || [])]
    .map((g) => ({
      ...g,
      people: [...g.people].sort((a, b) => b.pendingChanges - a.pendingChanges),
    }))
    .sort((a, b) => pendingIn(b) - pendingIn(a));

  return (
    <>
      <PageHeader
        title="Choose reviewers"
        context="Decide each requested change to a colleague list, then draw the reviewers. Nobody, HR included, is shown who was picked."
        backTo="/dashboard"
      />

      {cycleError ? (
        <Notice tone="text-danger">{cycleError}</Notice>
      ) : !cycles ? (
        <Notice>Loading…</Notice>
      ) : cycles.length === 0 ? (
        <Notice>
          No cycle has reached collecting yet, so there are no colleague lists to work on.
        </Notice>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label htmlFor="cycle" className="text-[13px] font-semibold text-ink">
              Cycle
            </label>
            <select
              id="cycle"
              value={cycleId}
              onChange={(e) => setChosenId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {cycles.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.parGroup} {c.year} · {c.status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <Notice tone="text-danger">{error}</Notice>
          ) : !data ? (
            <Notice>Loading…</Notice>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted">
                {data.total} {data.total === 1 ? "review" : "reviews"} ·{" "}
                <span className="text-ink">{data.undrawn} not yet drawn</span> ·{" "}
                <span className="text-ink">{data.awaitingHr} waiting for a decision</span>
              </p>

              {data.cycle.status !== "collecting" && (
                <p className="mb-4 text-[13px] text-muted">
                  This cycle has moved past collecting, so nothing more can be confirmed,
                  decided or drawn.
                </p>
              )}

              {groups.length === 0 ? (
                <Notice>This cycle has no reviews.</Notice>
              ) : (
                <div className="mt-4 grid gap-6">
                  {groups.map((group) => (
                    <Group key={group.supervisor?.id || "none"} group={group} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function Group({ group }) {
  return (
    <section className="rounded-xl border border-line bg-raised">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
        {group.supervisor
          ? `Supervised by ${group.supervisor.name}`
          : "Nobody supervises them, so HR covering them confirms the list"}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <Th>Name</Th>
              <Th>Employee ID</Th>
              <Th>List</Th>
              <Th>Requests waiting</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {group.people.map((row) => {
              const state = stateLabel(row.state);
              return (
                <tr key={row.reviewId} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{row.person?.name}</td>
                  <td className="px-4 py-3 text-muted">{row.person?.employeeId}</td>
                  <td className={`px-4 py-3 ${state.tone}`}>{state.label}</td>
                  <td className="px-4 py-3 text-muted">{row.pendingChanges || "None"}</td>
                  <td className="px-4 py-3">
                    {row.reviewId ? (
                      <Link
                        to={`/reviewer-lists/${row.reviewId}`}
                        state={{ from: "/choose-reviewers" }}
                        className="text-sm text-brand transition-colors hover:underline"
                      >
                        Open
                      </Link>
                    ) : (
                      <span className="text-muted">No review</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Notice({ children, tone = "text-muted" }) {
  return (
    <p className={`rounded-xl border border-line bg-raised p-5 text-sm ${tone}`}>
      {children}
    </p>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </th>
  );
}
