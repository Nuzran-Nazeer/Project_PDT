import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listFlags } from "../../services/monitoring";
import { listSummaryChecks } from "../../services/reviews";
import { getImprovementQueue, getOpenEscalations } from "../../services/plans";
import { listCycles } from "../../services/cycles";
import { listAudit } from "../../services/audit";
import { TABS_BY_GROUP } from "../../utils/dashboardTabs";
import { formatDateTime } from "../../utils/dates";
import Icon from "../common/Icon";
import CycleCard from "./CycleCard";

const QUEUES = [
  {
    id: "improvement-escalations",
    label: "Escalations",
    load: getOpenEscalations,
    field: "plans",
    title: "Resolve escalation",
  },
  {
    id: "monitoring",
    label: "Monitoring flags",
    load: listFlags,
    field: "items",
    title: "Review monitoring flag",
  },
  {
    id: "summaries-to-check",
    label: "Summary checks",
    load: listSummaryChecks,
    field: "items",
    title: "Check appraisal summary",
  },
  {
    id: "improvement-approvals",
    label: "Plan approvals",
    load: getImprovementQueue,
    field: "plans",
    title: "Decide improvement plan",
  },
];

function useWorkspaceData(tabs) {
  const [resources, setResources] = useState({});
  const [revision, setRevision] = useState(0);
  const key = tabs.map((tab) => tab.id).join(",");
  useEffect(() => {
    let cancelled = false;
    const ids = key.split(",");
    const requests = [
      ...QUEUES.filter((queue) => ids.includes(queue.id)),
      { id: "cycles", load: listCycles },
      ...(ids.includes("audit-trail") ? [{ id: "audit-trail", load: listAudit }] : []),
    ];
    for (const request of requests) {
      Promise.resolve()
        .then(() => request.load())
        .then(
          (data) =>
            !cancelled &&
            setResources((current) => ({ ...current, [request.id]: { data } })),
          (error) =>
            !cancelled &&
            setResources((current) => ({
              ...current,
              [request.id]: { error: error.message },
            })),
        );
    }
    return () => {
      cancelled = true;
    };
  }, [key, revision]);
  return [
    resources,
    () => {
      setResources({});
      setRevision((current) => current + 1);
    },
  ];
}

export default function HrWorkspace({ groups }) {
  const tabs = groups.flatMap((group) => TABS_BY_GROUP[group] || []);
  const queues = QUEUES.filter((queue) =>
    tabs.some((tab) => tab.id === queue.id && tab.built),
  );
  const [resources, refresh] = useWorkspaceData(tabs);
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const tasks = queues.flatMap((queue) =>
    (resources[queue.id]?.data?.[queue.field] || []).map((item, index) => ({
      key: `${queue.id}-${item.reviewId || item.id || item._id || index}`,
      category: queue.id,
      title: queue.title,
      detail: item.employee?.name || item.type?.replace(/_/g, " ") || queue.label,
      path:
        queue.id === "summaries-to-check"
          ? `/summaries-to-check/${item.reviewId}`
          : tabs.find((tab) => tab.id === queue.id).path,
    })),
  );
  const filtered = tasks.filter((task) => filter === "all" || task.category === filter);
  const ready = queues.every((queue) => resources[queue.id]?.data);
  const pending = queues.some((queue) => !resources[queue.id]);
  const quick = tabs.filter((tab) => tab.section === "People data" && tab.built);

  return (
    <div className="mb-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Your operational workspace</p>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-line bg-raised px-3 py-2 text-sm"
        >
          Refresh workspace
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {queues.map((queue) => (
          <Link
            key={queue.id}
            to={tabs.find((tab) => tab.id === queue.id).path}
            className="rounded-xl border border-line bg-raised p-5 transition-colors hover:border-muted"
          >
            <Icon
              name={queue.id === "summaries-to-check" ? "check" : "flag"}
              className="mb-3 h-5 w-5 text-muted"
            />
            <p className="text-sm text-muted">{queue.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {resources[queue.id]?.error
                ? "Unavailable"
                : resources[queue.id]?.data
                  ? resources[queue.id].data[queue.field].length
                  : "Loading…"}
            </p>
            <p className="mt-3 text-xs text-muted">Open queue →</p>
          </Link>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Needs your attention"
          action={
            filtered[0] && (
              <Link
                to={filtered[0].path}
                className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-ink"
              >
                Review next item
              </Link>
            )
          }
        >
          <div
            className="flex gap-5 overflow-x-auto border-b border-line px-5"
            aria-label="Attention filters"
          >
            {[{ id: "all", label: "All" }, ...queues].map((queue) => (
              <button
                type="button"
                key={queue.id}
                aria-pressed={filter === queue.id}
                onClick={() => {
                  setFilter(queue.id);
                  setShowAll(false);
                }}
                className={`shrink-0 border-b-2 py-3 text-xs ${filter === queue.id ? "border-brand font-semibold text-ink" : "border-transparent text-muted"}`}
              >
                {queue.label} (
                {queue.id === "all"
                  ? ready
                    ? tasks.length
                    : "…"
                  : resources[queue.id]?.data
                    ? resources[queue.id].data[queue.field].length
                    : "…"}
                )
              </button>
            ))}
          </div>
          {queues
            .filter((queue) => resources[queue.id]?.error)
            .map((queue) => (
              <p
                key={queue.id}
                role="alert"
                className="border-b border-line p-5 text-sm text-danger"
              >
                {queue.label}: {resources[queue.id].error}
              </p>
            ))}
          {pending && (
            <p role="status" className="p-5 text-sm text-muted">
              Loading attention queues…
            </p>
          )}
          {(showAll ? filtered : filtered.slice(0, 5)).map((task) => (
            <div
              key={task.key}
              className="flex flex-wrap items-center gap-3 border-b border-line p-5 last:border-0"
            >
              <span className="rounded-lg bg-secondary p-2.5 text-muted">
                <Icon name="clipboard" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{task.title}</p>
                <p className="mt-1 text-xs text-muted">{task.detail}</p>
              </div>
              <Link
                to={task.path}
                aria-label={`${task.title}: ${task.detail}`}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium"
              >
                Review →
              </Link>
            </div>
          ))}
          {!pending && filtered.length === 0 && (
            <p className="p-8 text-center text-sm text-muted">
              {ready
                ? "Nothing is waiting in this queue."
                : "No items loaded. Some queues are unavailable."}
            </p>
          )}
          {filtered.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="w-full p-4 text-sm text-ink"
            >
              {showAll ? "Show fewer" : `Show all ${filtered.length}`}
            </button>
          )}
        </Panel>
        <div className="min-w-0 space-y-6">
          <Panel
            title="Appraisal cycles"
            action={
              <Link to="/cycles" className="text-xs text-muted">
                View all →
              </Link>
            }
          >
            <ResourceState
              resource={resources.cycles}
              empty="No appraisal cycles available."
            >
              {resources.cycles?.data?.items
                ?.filter((cycle) => cycle.status !== "closed")
                .map((cycle) => (
                  <div key={cycle._id} className="p-4">
                    <CycleCard cycle={cycle} />
                  </div>
                ))}
            </ResourceState>
          </Panel>
          {groups.includes("oversight") && (
            <Panel
              title="Recent audit activity"
              action={
                <Link to="/audit-trail" className="text-xs text-muted">
                  View trail →
                </Link>
              }
            >
              <ResourceState
                resource={resources["audit-trail"]}
                empty="No recent audit activity."
              >
                {resources["audit-trail"]?.data?.items?.slice(0, 4).map((entry) => (
                  <div key={entry._id} className="border-b border-line p-5 last:border-0">
                    <p className="text-sm">{entry.action?.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDateTime(entry.at)} · {entry.outcome}
                    </p>
                  </div>
                ))}
              </ResourceState>
            </Panel>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {quick.map((tab) => (
          <Link
            key={tab.id}
            to={tab.path}
            className="rounded-xl border border-line bg-raised p-5"
          >
            <Icon name={tab.icon} className="mb-3 h-5 w-5 text-muted" />
            <p className="text-sm font-semibold">{tab.label}</p>
            <p className="mt-2 text-xs text-muted">{tab.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ResourceState({ resource, empty, children }) {
  if (resource?.error)
    return (
      <p role="alert" className="p-5 text-sm text-danger">
        {resource.error}
      </p>
    );
  if (!resource?.data)
    return (
      <p role="status" className="p-5 text-sm text-muted">
        Loading…
      </p>
    );
  if (!children?.length) return <p className="p-5 text-sm text-muted">{empty}</p>;
  return children;
}
