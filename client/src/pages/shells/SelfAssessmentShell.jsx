import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useCurrentCycle } from "../../hooks/useCurrentCycle";
import PageHeader from "../../components/layout/PageHeader";
import ShellNotice from "../../components/shells/ShellNotice";
import { competencyCount } from "../../utils/competencies";

// The way in to the self-assessment: which cycle, and one action to open the form.
// No cycle means no action, rather than an action that is refused.
export default function SelfAssessmentShell() {
  const { user, constants } = useAuth();
  const { cycle, parGroup, loading } = useCurrentCycle();

  const count = competencyCount(constants, user?.jobFamily);

  return (
    <>
      <PageHeader
        title="My self-assessment"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <ShellNotice>
        The cycle below is real. The form behind it is a shell: you can see its shape and
        every question it asks, and nothing you type is stored.
      </ShellNotice>

      {loading ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      ) : !cycle ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center">
          <p className="text-ink">No cycle to assess against</p>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
            {parGroup
              ? `The ${parGroup} group has no cycle running at the moment. A self-assessment opens when HR opens the cycle.`
              : "You are not in an appraisal group, so no cycle applies to you."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-raised p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-ink">
              {cycle.parGroup} group · {cycle.year}
            </h2>
            <span className="rounded-lg border border-brand/40 px-2.5 py-1 text-[12px] text-brand">
              {cycle.status.replace(/_/g, " ")}
            </span>
          </div>

          <p className="mt-2 max-w-prose text-[13px] text-muted">
            Your self-assessment for this cycle has not been started.{" "}
            {count > 0 && `It asks about ${count} competencies for ${user.jobFamily}, `}
            your progress against last cycle&rsquo;s goals, and a short reflection.
          </p>

          <Link
            to="/my-self-assessment/form"
            className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Add my assessment
          </Link>
        </div>
      )}

      <p className="mt-4 max-w-prose text-[13px] text-muted">
        Your supervisor cannot start their review of you until this is submitted, so it is
        the first step of the cycle rather than an optional one.
      </p>
    </>
  );
}
