import { NavLink } from "react-router-dom";
import Icon from "../common/Icon";
import { GROUP_LABELS, DASHBOARD_TAB, TABS_BY_GROUP } from "../../utils/dashboardTabs";

// The sidebar, and the place the one dashboard per person rule becomes visible.
//
// A person holding two roles does not get two screens to switch between. They get one
// sidebar with two GROUPS in it: a supervisor sees a Supervisor group and a My own
// appraisal group, stacked, and everything in both is one click away. Which groups
// appear is worked out in utils/dashboardSections.js and passed in here, because that
// question is about the person and this file is about drawing.
//
// The dashboard link is not in any group. Everybody has exactly one dashboard, so it
// sits at the top of the first group rather than being repeated in each.
//
// TWO SHAPES, ONE COMPONENT. On a wide window it is a rail that collapses to icons.
// Below `md` a 240px rail would leave under 100px of content column, so it becomes a
// drawer over the page instead, and AppLayout decides which of the two the hamburger
// is operating.
export default function Sidebar({ groups, collapsed, drawer = false, onNavigate }) {
  return (
    <nav
      // Two navigation landmarks exist in this frame. Unlabelled, a screen reader
      // announces "navigation" twice with nothing to tell them apart.
      aria-label="Sections"
      className={
        drawer
          ? "flex h-full w-60 flex-col gap-6 overflow-y-auto border-r border-line bg-raised py-6"
          : // `no-scrollbar` keeps the scrolling and drops the bar. A second scrollbar
            // beside the page's own reads as a defect rather than as a control.
            "no-scrollbar sticky top-16 flex max-h-[calc(100svh-4rem)] flex-col gap-6 overflow-y-auto py-6"
      }
    >
      {/* An administrator holds no delivered group at all, so without this their
          sidebar would be empty and there would be no way back to the dashboard. */}
      {groups.length === 0 && (
        <div>
          <p
            className={`px-4 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted ${
              collapsed && !drawer ? "sr-only" : ""
            }`}
          >
            Menu
          </p>
          <ul>
            <li>
              <SidebarLink
                tab={DASHBOARD_TAB}
                narrow={collapsed && !drawer}
                onNavigate={onNavigate}
              />
            </li>
          </ul>
        </div>
      )}

      {groups.map((group, index) => {
        const isFirst = index === 0;
        const label = GROUP_LABELS[group]?.[isFirst ? "primary" : "secondary"] || group;
        const tabs = TABS_BY_GROUP[group] || [];
        // A drawer is always full width: there is no room to collapse something that
        // is already an overlay, and nothing to gain from it.
        const narrow = collapsed && !drawer;

        return (
          <div key={group}>
            {/* Hidden from sight but not from a screen reader when the rail is narrow.
                It is not merely made invisible: an invisible heading still occupies a
                64px column, wraps to three lines of nothing, and pushes the icons
                apart. The gap between groups comes from the flex gap either way. */}
            <p
              className={`px-4 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted ${
                narrow ? "sr-only" : ""
              }`}
            >
              {label}
            </p>

            <ul>
              {(isFirst ? [DASHBOARD_TAB, ...tabs] : tabs).map((tab) => (
                <li key={tab.id}>
                  <SidebarLink tab={tab} narrow={narrow} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarLink({ tab, narrow, onNavigate }) {
  return (
    <NavLink
      to={tab.path}
      onClick={onNavigate}
      // A tooltip as well as the label below, not instead of it. `title` is a
      // last-resort accessible name, never reaches a touch device, and does not show
      // on keyboard focus.
      title={narrow ? tab.label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 border-l-2 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${
          narrow ? "justify-center px-0" : "px-4"
        } ${
          isActive
            ? // Brand tinted rather than `bg-surface`. Surface is the colour of the
              // content area beside it, so an active item painted in it reads as a
              // notch cut out of the sidebar instead of as the current page.
              "border-brand bg-brand/10 font-medium text-ink"
            : "border-transparent text-muted hover:text-ink"
        }`
      }
    >
      <Icon name={tab.icon} className="h-4 w-4 shrink-0" />
      {/* Always rendered. Unmounting it leaves the link with no accessible name at
          all, because the icon beside it is decorative and hidden. */}
      <span className={narrow ? "sr-only" : "truncate"}>{tab.label}</span>
    </NavLink>
  );
}
