import { Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import ThemeToggle from "../common/ThemeToggle";

// The shell every signed-in screen sits inside: who you are, the way out, and
// the theme switch. The toggle lives here now rather than floating in App.jsx,
// which is where it was parked until a layout existed.
//
// Navigation between screens is deliberately absent. Nobody has designed it, and
// the alternative to leaving it out is inventing it.
export default function AppLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-svh bg-surface text-ink">
      <header className="border-b border-line bg-raised">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <span className="font-semibold tracking-tight">PDT</span>

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
