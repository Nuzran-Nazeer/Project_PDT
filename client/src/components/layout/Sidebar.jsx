import { NavLink } from "react-router-dom";
import Icon from "../common/Icon";
import { GROUP_LABELS, DASHBOARD_TAB, TABS_BY_GROUP } from "../../utils/dashboardTabs";

// A collapsing rail on a wide window, a drawer below `md`.
export default function Sidebar({ groups, collapsed, drawer = false, onNavigate }) {
  return (
    <nav
      // Two nav landmarks exist; unlabelled, a screen reader cannot tell them apart.
      aria-label="Sections"
      className={
        drawer
          ? "flex h-full w-60 flex-col gap-6 overflow-y-auto border-r border-line bg-raised py-6"
          : // A second scrollbar beside the page's own reads as a defect.
            "no-scrollbar sticky top-16 flex max-h-[calc(100svh-4rem)] flex-col gap-6 overflow-y-auto py-6"
      }
    >
      {/* An administrator holds no rendered group and still needs a way back. */}
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
        const narrow = collapsed && !drawer;

        return (
          <div key={group}>
            {/* `sr-only`, not invisible: an invisible heading still takes up the column. */}
            <p
              className={`px-4 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted ${
                narrow ? "sr-only" : ""
              }`}
            >
              {label}
            </p>

            <ul>
              {(isFirst ? [DASHBOARD_TAB, ...tabs] : tabs).map((tab, at, all) => (
                <li key={tab.id}>
                  {tab.section && tab.section !== all[at - 1]?.section && (
                    <p
                      className={`px-4 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted/70 ${
                        narrow ? "sr-only" : ""
                      }`}
                    >
                      {tab.section}
                    </p>
                  )}
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
      // As well as the label, never instead of it: `title` never reaches a touch device.
      title={narrow ? tab.label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 border-l-2 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${
          narrow ? "justify-center px-0" : "px-4"
        } ${
          isActive
            ? // Not `bg-surface`: an active item would read as a notch cut out of the sidebar.
              "border-brand bg-brand/10 font-medium text-ink"
            : "border-transparent text-muted hover:text-ink"
        }`
      }
    >
      <Icon name={tab.icon} className="h-4 w-4 shrink-0" />
      {/* Always rendered: unmounting leaves the link with no accessible name. */}
      <span className={narrow ? "sr-only" : "truncate"}>{tab.label}</span>
    </NavLink>
  );
}
