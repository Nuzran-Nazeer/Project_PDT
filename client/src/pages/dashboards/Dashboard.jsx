import { useAuth } from "../../hooks/useAuth";
import { useReportingLine } from "../../hooks/useReportingLine";
import { useCurrentCycle } from "../../hooks/useCurrentCycle";
import { useTeam } from "../../hooks/useTeam";
import { sectionGroupsFor } from "../../utils/dashboardSections";
import { GROUP_OVERVIEW, TABS_BY_GROUP } from "../../utils/dashboardTabs";
import { formatDate } from "../../utils/dates";
import {
  SHOW_PLACEHOLDER_FIGURES,
  PLACEHOLDER_TILES,
} from "../../dev/placeholderFigures";
import PageHeader from "../../components/layout/PageHeader";
import IdentityCard from "../../components/dashboard/IdentityCard";
import CycleCard from "../../components/dashboard/CycleCard";
import StatTile from "../../components/dashboard/StatTile";
import ActionRow from "../../components/dashboard/ActionRow";
import MySupervisorPanel from "../../components/org/MySupervisorPanel";

// One dashboard for everybody; the sections it carries come from
// dashboardSections.js.
export default function Dashboard() {
  const { user, isSupervisor, sessionReady } = useAuth();
  const { line, loading: lineLoading, error: lineError } = useReportingLine();
  const { team } = useTeam();
  const { cycle, parGroup: cycleGroup, loading: cycleLoading } = useCurrentCycle();

  // `isSupervisor` is false until the server answers, so drawing early would
  // rearrange the dashboard under the reader.
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

  const tiles = SHOW_PLACEHOLDER_FIGURES
    ? PLACEHOLDER_TILES[primary] || PLACEHOLDER_TILES.employee
    : realTiles(user, line, lineLoading, team);

  return (
    <>
      <PageHeader
        title={overview.pageTitle}
        // Not a list of roles: that would put a ladder on screen.
        context={[user?.designation, user?.parGroup && `${user.parGroup} group`]
          .filter(Boolean)
          .join(" · ")}
      />

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

// A tile is left out rather than shown empty, so somebody with no unit gets fewer
// tiles rather than a row reading "None".
function realTiles(user, line, lineLoading, team) {
  const unit = lineLoading ? "…" : line?.unit?.name;

  return [
    // Absent rather than nought, which would read as "your team is empty".
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
    user?.parGroup && {
      value: user.parGroup,
      label: "Your appraisal group, set by when you joined",
      icon: "target",
      tone: "green",
    },
    user?.joinedDate && {
      value: formatDate(user.joinedDate),
      label: "At Altrium since",
      icon: "calendar",
      tone: "amber",
    },
  ].filter(Boolean);
}

// ⚠️ Undefined, never an empty array: an empty array is truthy, so returning one
// silently suppresses the placeholder for every other row.
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
