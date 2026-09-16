import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { sectionGroupsFor } from "../../utils/dashboardSections";
import ThemeToggle from "../common/ThemeToggle";
import Icon from "../common/Icon";
import Sidebar from "./Sidebar";

// ⚠️ Nothing about access is decided here: a missing sidebar link never means a screen is protected.
const WIDE = "(min-width: 768px)";

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

  // Drawn before the server answers, since everybody holds the employee role.
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
        // Storage throws in a private window; the rail still collapses, unremembered.
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

          {/* `min-w-0` stops a long name giving the page a horizontal scrollbar. */}
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

      {/* `min-h` stops the rail ending halfway down a short page. */}
      <div className="flex min-h-[calc(100svh-4rem)]">
        <aside
          className={`hidden shrink-0 border-r border-line bg-raised transition-[width] duration-200 md:block ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          <Sidebar groups={groups} collapsed={collapsed} />
        </aside>

        {/* ⚠️ The breakpoints are arithmetic: content is capped at 1180, so the mirrored
            padding fits only above 1180 + 2 x rail (1660 open, 1308 collapsed). */}
        <main
          className={`min-w-0 flex-1 transition-[padding] duration-200 ${
            collapsed ? "min-[1308px]:pr-16" : "min-[1660px]:pr-60"
          }`}
        >
          <div className="mx-auto w-full max-w-[1180px] px-6 py-8 sm:px-10">
            <Outlet />
          </div>
        </main>
      </div>

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

// First and last word; one word gives one letter.
function initials(name) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
