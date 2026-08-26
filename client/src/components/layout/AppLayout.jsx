import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import ThemeToggle from "../common/ThemeToggle";

// The shell every signed-in screen sits inside: who you are, the way out, and
// the theme switch. The toggle lives here now rather than floating in App.jsx,
// which is where it was parked until a layout existed.
//
// Navigation is still deliberately minimal. Nobody has designed a nav, and the
// alternative to leaving it out is inventing one — so these are plain links to the
// screens that exist beyond the dashboards, not the start of a menu. A built screen
// nobody can reach is worse than a plain link, which is the reasoning that added the
// second one when the organisation tree landed.
//
// The two lists are identical today and are kept apart on purpose: the roster and
// the tree are read by the same three roles by coincidence, not by a shared rule,
// and collapsing them into one constant would hide that the next screen might not
// match either.
const ROSTER_ROLES = ["hr", "head_of_hr", "leadership"];
const ORG_ROLES = ["hr", "head_of_hr", "leadership"];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const canSeeRoster = user?.roles?.some((role) => ROSTER_ROLES.includes(role));
  const canSeeOrg = user?.roles?.some((role) => ORG_ROLES.includes(role));

  return (
    <div className="min-h-svh bg-surface text-ink">
      <header className="border-b border-line bg-raised">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <span className="font-semibold tracking-tight">PDT</span>

          {canSeeRoster && (
            <NavLink
              to="/employees"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-brand ${
                  isActive ? "text-brand" : "text-muted"
                }`
              }
            >
              Employees
            </NavLink>
          )}

          {canSeeOrg && (
            <NavLink
              to="/organisation"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-brand ${
                  isActive ? "text-brand" : "text-muted"
                }`
              }
            >
              Organisation
            </NavLink>
          )}

          <div className="ml-auto flex items-center gap-4">
            {user && (
              <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
            )}
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              className="cursor-pointer rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
