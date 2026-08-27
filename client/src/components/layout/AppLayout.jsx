import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { sectionGroupsFor } from "../../utils/dashboardSections";
import ThemeToggle from "../common/ThemeToggle";
import Icon from "../common/Icon";
import Sidebar from "./Sidebar";

// The frame every signed in screen sits inside: a top bar and the sidebar.
//
// The sidebar replaced a header full of links. Those links were fine while there were
// three screens and stop working at thirty, which is what the mockups design towards.
//
// THE HAMBURGER DOES TWO DIFFERENT THINGS, on purpose. On a wide window it collapses
// the rail to icons. Below `md` a 240px rail would leave under 100px of content
// column, so there the same button opens the sidebar as a drawer over the page. Which
// one is happening is decided here rather than inside the sidebar, because it is a
// question about the window and not about navigation.
// THE HEADER CARRIES NO NAVIGATION ANY MORE.
//
// Employee records, Organisation and Cycles were centred links here from 2026-08-26,
// deferred until the sidebar's HR group opened. It opened on 2026-08-27 and they moved
// into it, under PEOPLE DATA and RUNNING THE CYCLE, which is where the mockups put
// them. Two navigations for one app was always the temporary state.
//
// ⚠️ NOTHING ABOUT ACCESS CHANGED, and it must not. The roles that may reach those
// three screens are decided by their routes in AppRoutes.jsx, which are untouched --
// Leadership still reads the roster and the tree by URL. What moved is where the link
// is drawn. A Leadership account has no sidebar group yet, so it currently has no link
// to them; that is what opening the leadership group fixes, and it is a story of its
// own rather than a reason to keep a second navigation bar.
//
// The old "My team" header link is gone rather than moved. It pointed at the separate
// supervisor dashboard, which no longer exists as a screen.
const WIDE = "(min-width: 768px)";

// Remembered per browser, so somebody who prefers the narrow rail is not fighting it
// on every page load. Reading storage can throw in a private window, and a thrown
// preference must not take the whole layout down, so it is guarded.
const COLLAPSE_KEY = "pdt.sidebar.collapsed";

function storedCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
}

export default function AppLayout() {
  const { user, signOut, isSupervisor, sessionReady } = useAuth();
  const isWide = useMediaQuery(WIDE);

  const [collapsed, setCollapsed] = useState(storedCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The drawer is closed from the link that was clicked, not from an effect watching
  // the URL. A drawer covers the page it just navigated to, so it has to go; doing it
  // in the click is one render rather than two, and clicking a link is the only way
  // to navigate out of it.

  // Everybody holds the employee role, so that group can be drawn before the server
  // answers. Waiting for the whole sidebar would show a 240px empty rail beside a
  // spinner on every first load, and the supervisor group simply appears when the
  // answer lands.
  const groups = sessionReady
    ? sectionGroupsFor(user?.roles, isSupervisor)
    : sectionGroupsFor(user?.roles, false);

  function toggleSidebar() {
    if (!isWide) {
      setDrawerOpen((open) => !open);
      return;
    }

    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // A browser refusing to store a preference is not a reason to refuse to
        // collapse the rail. It just will not be remembered.
      }
      return next;
    });
  }

  const expanded = isWide ? !collapsed : drawerOpen;

  return (
    <div className="min-h-svh bg-surface text-ink">
      <header className="sticky top-0 z-30 h-16 border-b border-line bg-raised">
        <div className="flex h-full items-center gap-4 px-4">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={expanded ? "Hide the sidebar" : "Show the sidebar"}
            aria-expanded={expanded}
            className="cursor-pointer rounded-lg p-2 text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <NavLink
            to="/dashboard"
            className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-[11px] font-bold text-white">
              PDT
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[15px] font-semibold">Altrium</span>
              <span className="block text-[11px] text-muted">
                Performance &amp; Development
              </span>
            </span>
          </NavLink>

          {/* `ml-auto` is what holds this group against the right edge. It used to be
              pushed there by the centred nav that sat between it and the logo; that nav
              moved into the sidebar on 2026-08-27 and this group slid back against the
              logo, because nothing was absorbing the free space any more.

              `min-w-0` stops a long name growing this group without limit and pushing
              the row past the viewport, which produces a page level horizontal
              scrollbar rather than a truncated name. */}
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <ThemeToggle />

            {user && (
              <span className="hidden min-w-0 items-center gap-3 sm:flex">
                <span className="min-w-0 text-right leading-tight">
                  <span className="block truncate text-[13px] font-semibold">
                    {user.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {user.employeeId}
                  </span>
                </span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-[12px] font-bold text-white">
                  {initials(user.name)}
                </span>
              </span>
            )}

            <button
              type="button"
              onClick={signOut}
              className="shrink-0 cursor-pointer rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* `min-h` is what stops the rail ending halfway down a short page. A flex row
          is only as tall as its tallest child, so on the employee dashboard the aside
          stopped where the content did and left bare surface beneath it. */}
      <div className="flex min-h-[calc(100svh-4rem)]">
        {/* The rail. Present only on a wide window; below that the same sidebar is
            rendered as the drawer further down. */}
        <aside
          className={`hidden shrink-0 border-r border-line bg-raised transition-[width] duration-200 md:block ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          <Sidebar groups={groups} collapsed={collapsed} />
        </aside>

        {/* THE PADDING ON THE RIGHT KEEPS THE CONTENT CENTRED IN THE WINDOW, BUT ONLY
            WHERE THAT IS FREE. Without it the content is centred in whatever is left of
            the window after the sidebar, so collapsing the rail slides everything
            sideways and the reader loses their place. Reserving the rail's width on the
            far side too makes the free space symmetrical, so nothing moves.

            ⚠️ IT USED TO APPLY AT EVERY WIDTH, AND THAT WAS WRONG. The content is capped
            at 1180px. With the rail open on a 1536px window the sum was 240 + 1180 + 240
            = 1660, more than the window, so the content was squeezed to about 1056px and
            the screen looked narrower with the sidebar open than with it shut -- while
            plainly having room. Reported 2026-08-27.

            So the balance is applied only above the width where it costs nothing: 1180
            plus twice the rail. Below that the padding drops and the content takes the
            space it has. The content still does not move at the widths where it used
            not to; it simply stops being squeezed at the widths where it was. */}
        <main
          className={`min-w-0 flex-1 transition-[padding] duration-200 ${
            collapsed ? "min-[1308px]:pr-16" : "min-[1660px]:pr-60"
          }`}
        >
          {/* The mockups are drawn at roughly this column width. Without a cap, an
              action row on a wide monitor stretches to a metre of empty space with an
              icon pinned to one end and a chevron to the other. */}
          <div className="mx-auto w-full max-w-[1180px] px-6 py-8 sm:px-10">
            <Outlet />
          </div>
        </main>
      </div>

      {/* The drawer, below `md` only. Rendered outside the flex row so it overlays the
          page rather than taking a column out of it. */}
      {!isWide && drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close the sidebar"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 w-60 shadow-xl">
            <Sidebar
              groups={groups}
              collapsed={false}
              drawer
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// First and last word, so "Test Officer" reads TO. One word gives one letter rather
// than two of the same.
function initials(name) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
