import { useAuth } from "../../hooks/useAuth";
import { useReportingLine } from "../../hooks/useReportingLine";
import { useCurrentCycle } from "../../hooks/useCurrentCycle";
import { useTeam } from "../../hooks/useTeam";
import { sectionGroupsFor } from "../../utils/dashboardSections";
import { GROUP_OVERVIEW, TABS_BY_GROUP } from "../../utils/dashboardTabs";
import { formatDate } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import IdentityCard from "../../components/dashboard/IdentityCard";
import CycleCard from "../../components/dashboard/CycleCard";
import StatTile from "../../components/dashboard/StatTile";
import ActionRow from "../../components/dashboard/ActionRow";
import MySupervisorPanel from "../../components/org/MySupervisorPanel";

// One dashboard for everybody; the sections come from dashboardSections.js.
export default function Dashboard() {
  const { user, isSupervisor, sessionReady } = useAuth();
  const { line, loading: lineLoading, error: lineError } = useReportingLine();
  const { team } = useTeam();
  const { cycle, parGroup: cycleGroup, loading: cycleLoading } = useCurrentCycle();

  // `isSupervisor` is false until the server answers.
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

  const tiles = tilesFor(user, line, lineLoading, team);

  return (
    <>
      <PageHeader title={overview.pageTitle} context={user?.designation} />

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <IdentityCard
          name={user?.name}
          roleLabel={overview.roleLabel}
          employeeId={user?.employeeId}
        />
        <CycleCard
          cycle={cycle}
          parGroup={cycleGroup || user?.parGroup}
          loading={cycleLoading}
        />
      </div>

      {tiles.length > 0 && (
        <Section heading="Quick overview">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => (
              <StatTile key={tile.label} {...tile} />
            ))}
          </div>
        </Section>
      )}

      <Section heading="Your reporting line">
        <MySupervisorPanel line={line} loading={lineLoading} error={lineError} />
      </Section>

      {groups.map((group, index) => {
        const tabs = TABS_BY_GROUP[group] || [];
        if (tabs.length === 0) return null;

        const headings = GROUP_OVERVIEW[group] || GROUP_OVERVIEW.employee;

        return (
          <Section
            key={group}
            heading={index === 0 ? headings.primaryHeading : headings.secondaryHeading}
          >
            <div className="grid gap-3">
              {tabs.map((tab) => (
                <ActionRow key={tab.id} tab={tab} status={rowStatus(tab.id, team)} />
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );
}

// A tile is left out rather than shown empty.
function tilesFor(user, line, lineLoading, team) {
  const unit = lineLoading ? "…" : line?.unit?.name;

  return [
    team && {
      value: String(team.total),
      label: team.total === 1 ? "Person you supervise" : "People you supervise",
      icon: "users",
      tone: "blue",
    },
    {
      value: unit || "No unit",
      label: unit ? "Your unit" : "You are in no unit, so you are not appraised",
      icon: "sitemap",
      tone: "blue",
    },
    user?.jobFamily && {
      value: user.jobFamily,
      label: "Your job family, which selects your review form",
      icon: "clipboard",
      tone: "violet",
    },
    user?.joinedDate && {
      value: formatDate(user.joinedDate),
      label: "At Altrium since",
      icon: "calendar",
      tone: "amber",
    },
  ].filter(Boolean);
}

function rowStatus(tabId, team) {
  if (tabId !== "my-team" || !team) return undefined;

  return [
    {
      text: `${team.total} ${team.total === 1 ? "person" : "people"}`,
      tone: "muted",
      icon: "users",
    },
  ];
}

function Section({ heading, children }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
        {heading}
      </h2>
      {children}
    </section>
  );
}
