import { useAuth } from "../../hooks/useAuth";
import { useReportingLine } from "../../hooks/useReportingLine";
import { sectionGroupsFor } from "../../utils/dashboardSections";
import { GROUP_OVERVIEW, TABS_BY_GROUP } from "../../utils/dashboardTabs";
import { formatDate } from "../../utils/dates";
import {
  SHOW_PLACEHOLDER_FIGURES,
  placeholderCycleFor,
  PLACEHOLDER_TILES,
} from "../../dev/placeholderFigures";
import PageHeader from "../../components/layout/PageHeader";
import IdentityCard from "../../components/dashboard/IdentityCard";
import CycleCard from "../../components/dashboard/CycleCard";
import StatTile from "../../components/dashboard/StatTile";
import ActionRow from "../../components/dashboard/ActionRow";
import MySupervisorPanel from "../../components/org/MySupervisorPanel";

// THE dashboard. There is one, and every signed in person gets the same route.
//
// It replaced six separate dashboard pages, one per role. The design rule is locked:
// one dashboard per person, not one per role, and the mockups draw it as one sidebar
// with a group per role rather than six screens to switch between.
//
// WHICH GROUPS APPEAR IS GATED BY WHICH STORY IS DELIVERED, in dashboardSections.js.
// Today that is the employee group and nothing else: the HR dashboard is story 16 and
// the supervisor dashboard is story 17, and neither has been built. The machinery for
// stacking groups belongs to this story, because one dashboard per person cannot be
// built without it. Their contents do not.
//
// WHAT IS REAL ON THIS SCREEN. With the placeholder flag off, everything here is
// answered by the database or by the session: the greeting, the job title, the
// appraisal group, the unit, the supervisor, the job family, the joining date, and
// every action row as a working link. What is missing is missing on purpose. There is
// no cycle, feedback or plan collection on the server, so the cycle banner says so and
// the action rows carry no status.
export default function Dashboard() {
  const { user, isSupervisor, sessionReady } = useAuth();
  const { line, loading: lineLoading, error: lineError } = useReportingLine();

  // Whether somebody leads a unit is answered by the server, and is false until the
  // answer lands. Drawing first would show one dashboard and then rearrange it under
  // the reader.
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
    : realTiles(user, line, lineLoading);

  return (
    <>
      <PageHeader
        title={overview.pageTitle}
        // Their own record, not a list of their roles. Somebody holding three roles is
        // still one person with one job title, and naming the roles here would put a
        // ladder on the screen that this design deliberately does not have.
        context={[user?.designation, user?.parGroup && `${user.parGroup} group`]
          .filter(Boolean)
          .join(" · ")}
      />

      {/* Not two equal halves, and the greeting takes the WIDER side. The mockup gives
          that room to the cycle banner instead, and Nuzran overruled it on 2026-08-26:
          the greeting is the part of this row that is real. `items-stretch` keeps the
          two the same height. */}
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        {/* The chip is the ROLE, not the job title. The job title is already under the
            page title, and repeating it wastes the one line the card has. */}
        <IdentityCard
          name={user?.name}
          roleLabel={overview.roleLabel}
          employeeId={user?.employeeId}
        />
        <CycleCard cycle={placeholderCycleFor(user?.parGroup)} />
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

      {/* It appears in none of the mockups, because it arrived from the reporting line
          story rather than this one. It sits after the figures and before the action
          lists: high enough to be found, and not displacing the top row the design
          does specify. */}
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
                <ActionRow key={tab.id} tab={tab} />
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );
}

// The figures the system can actually answer today.
//
// NONE OF THEM IS APPRAISAL ACTIVITY, because none exists: no cycle has been created,
// nobody has written anything, and no plan has been agreed. What does exist is where
// this person sits in the organisation, which is real to the last field. When the
// cycle and the reviews land, these are the tiles that give way to them.
//
// A tile is left out rather than shown empty when its value is missing, so an
// administrator with no unit and no appraisal group gets fewer tiles rather than a row
// reading "None".
function realTiles(user, line, lineLoading) {
  const unit = lineLoading ? "…" : line?.unit?.name;

  return [
    {
      value: unit || "No unit",
      // The two labels say different things, and the second is a real fact about this
      // person's appraisal rather than a missing value.
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
