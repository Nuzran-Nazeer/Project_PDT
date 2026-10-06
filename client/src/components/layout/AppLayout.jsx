import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
  const { pathname } = useLocation();
  const { user, signOut, isSupervisor, sessionReady } = useAuth();
  const isWide = useMediaQuery(WIDE);

  const [collapsed, setCollapsed] = useState(storedCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const sidebarToggleRef = useRef(null);

  useEffect(() => {
    if (isWide || !drawerOpen) return undefined;
    const opener = sidebarToggleRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => [
      ...drawerRef.current.querySelectorAll("a[href], button:not(:disabled)"),
    ];
    controls()[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
      }
      if (event.key !== "Tab") return;
      const elements = controls();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [drawerOpen, isWide]);

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
      <a
        href="#workspace-content"
        className="sr-only fixed left-4 top-2 z-50 rounded-lg bg-raised px-4 py-2 text-ink focus:not-sr-only"
      >
        Skip to content
      </a>
      <header
        inert={!isWide && drawerOpen}
        className="sticky top-0 z-30 h-16 border-b border-line bg-raised"
      >
        <div className="flex h-full items-center gap-4 px-4">
          <button
            ref={sidebarToggleRef}
            type="button"
            onClick={toggleSidebar}
            aria-label={expanded ? "Hide the sidebar" : "Show the sidebar"}
            aria-expanded={expanded}
            className="cursor-pointer rounded-lg p-2 text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <NavLink
            to="/dashboard"
            className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-bold text-ink">
                  {initials(user.name)}
                </span>
              </span>
            )}

            <button
              type="button"
              onClick={signOut}
              className="shrink-0 cursor-pointer rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* `min-h` stops the rail ending halfway down a short page. */}
      <div inert={!isWide && drawerOpen} className="flex min-h-[calc(100svh-4rem)]">
        <aside
          className={`hidden shrink-0 border-r border-line bg-raised transition-[width] duration-200 md:block ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          <Sidebar groups={groups} collapsed={collapsed} />
        </aside>

        <main
          id="workspace-content"
          tabIndex={-1}
          className={`relative isolate min-w-0 flex-1 transition-[padding] duration-200 ${
            collapsed ? "min-[1308px]:pr-16" : "min-[1660px]:pr-60"
          }`}
        >
          {pathname === "/dashboard" && (
            <div
              aria-hidden="true"
              className={`pointer-events-none fixed inset-x-0 bottom-0 top-16 -z-10 overflow-hidden ${collapsed ? "md:left-16" : "md:left-60"}`}
            >
              <div className="blob-float-1 absolute -left-48 -top-36 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle_at_30%_30%,var(--color-brand),transparent_70%)] opacity-15 blur-2xl dark:opacity-20" />
              <div className="blob-float-2 absolute -right-56 top-[55vh] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_60%_60%,var(--color-brand),transparent_70%)] opacity-15 blur-2xl dark:opacity-20" />
            </div>
          )}
          <div className="relative mx-auto w-full max-w-[1450px] px-4 py-6 sm:px-8 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {!isWide && drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-40 md:hidden"
        >
          <button
            type="button"
            aria-label="Dismiss navigation backdrop"
            tabIndex={-1}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/50"
          />
          <div
            ref={drawerRef}
            className="absolute inset-y-0 left-0 flex w-60 flex-col bg-raised shadow-xl"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="mx-4 mt-4 rounded-lg border border-line px-3 py-2 text-sm text-ink"
            >
              Close the sidebar
            </button>
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
