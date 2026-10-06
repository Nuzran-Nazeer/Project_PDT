import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useCurrentCycle } from "../../hooks/useCurrentCycle";
import { useTeam } from "../../hooks/useTeam";
import { sectionGroupsFor } from "../../utils/dashboardSections";
import { GROUP_OVERVIEW, TABS_BY_GROUP } from "../../utils/dashboardTabs";
import PageHeader from "../../components/layout/PageHeader";
import IdentityCard from "../../components/dashboard/IdentityCard";
import CycleCard from "../../components/dashboard/CycleCard";
import ActionRow from "../../components/dashboard/ActionRow";
import HrWorkspace from "../../components/dashboard/HrWorkspace";

const WORKSPACE_CONTEXT = {
  oversight: "Review operational queues and oversee appraisal activity.",
  hr: "Manage appraisal cycles and review work within your coverage.",
  leadership: "Explore company reports and organisational records.",
  supervisor: "Review your team and follow their development actions.",
  employee: "Your appraisal, assigned feedback and development plans.",
};
const WORKSPACE_LABELS = {
  leadership: "Company reports",
  supervisor: "Team workflows",
  employee: "My appraisal",
};

export default function Dashboard() {
  const { user, isSupervisor, sessionReady } = useAuth();
  if (!sessionReady) {
    return (
      <p className="p-10 text-center text-muted" role="status">
        Loading…
      </p>
    );
  }
  const groups = sectionGroupsFor(user?.roles, isSupervisor);
  const primary = groups[0] || "employee";
  const overview = GROUP_OVERVIEW[primary];
  return (
    <>
      <PageHeader title={overview.pageTitle} context={WORKSPACE_CONTEXT[primary]} />
      <IdentityCard
        wide
        name={user?.name}
        roleLabel={overview.roleLabel}
        employeeId={user?.employeeId}
      />
      <div className="mt-6">
        {groups.includes("hr") ? (
          <HrWorkspace groups={groups} />
        ) : (
          <RoleWorkspace groups={groups} />
        )}
      </div>
    </>
  );
}

function RoleWorkspace({ groups }) {
  const { team, loading: teamLoading, error: teamError } = useTeam();
  const { cycle, parGroup, loading, error } = useCurrentCycle();
  const [filter, setFilter] = useState(groups[0] || "employee");
  const [page, setPage] = useState(0);
  const tabs = (TABS_BY_GROUP[filter] || []).filter(
    (tab) => tab.built && tab.section !== "People data",
  );
  const visible = tabs.slice(page * 6, (page + 1) * 6);
  return (
    <div className="space-y-6">
      <div
        className={`grid items-start gap-6 ${groups.includes("supervisor") ? "lg:grid-cols-2" : ""}`}
      >
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
          >
            Appraisal cycle: {error}
          </p>
        ) : (
          <CycleCard cycle={cycle} parGroup={parGroup} loading={loading} />
        )}
        {groups.includes("supervisor") && (
          <section className="rounded-xl border border-line bg-raised p-5">
            <h2 className="text-base font-semibold">Team overview</h2>
            {teamError ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {teamError}
              </p>
            ) : (
              <p
                role={teamLoading ? "status" : undefined}
                className="mt-3 text-sm text-muted"
              >
                {teamLoading
                  ? "Loading team…"
                  : team
                    ? `${team.total} ${team.total === 1 ? "person" : "people"} you supervise`
                    : "No team information available."}
              </p>
            )}
          </section>
        )}
      </div>
      <section className="overflow-hidden rounded-xl border border-line bg-raised">
        <div className="border-b border-line p-5">
          <h2 className="text-base font-semibold">Your workspace</h2>
          <p className="mt-1 text-sm text-muted">
            Open a workflow to review its current status and next steps.
          </p>
        </div>
        <div
          aria-label="Workspace filters"
          className="flex gap-5 overflow-x-auto border-b border-line px-5"
        >
          {groups.map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={filter === group}
              onClick={() => {
                setFilter(group);
                setPage(0);
              }}
              className={`shrink-0 border-b-2 py-3 text-xs ${filter === group ? "border-brand font-semibold text-ink" : "border-transparent text-muted"}`}
            >
              {WORKSPACE_LABELS[group]}
            </button>
          ))}
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {visible.map((tab) => (
            <ActionRow key={tab.id} tab={tab} />
          ))}
        </div>
        {tabs.length > 6 && (
          <div className="flex items-center justify-between border-t border-line p-4">
            <p className="text-xs text-muted">
              {page * 6 + 1} to {page * 6 + visible.length} of {tabs.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="workflow-secondary"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="workflow-secondary"
                disabled={(page + 1) * 6 >= tabs.length}
                onClick={() => setPage(page + 1)}
              >
                More
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
