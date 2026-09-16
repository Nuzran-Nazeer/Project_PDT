import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getSelfAssessment } from "../../services/feedback";
import PageHeader from "../../components/layout/PageHeader";

// ⚠️ The state comes off the endpoint, never from the cycle alone: a saved draft is not "not started".

const STATE = {
  not_started: {
    line: "Your self-assessment for this cycle has not been started.",
    action: "Add my assessment",
  },
  assigned: {
    line: "Your self-assessment for this cycle has not been started.",
    action: "Add my assessment",
  },
  draft: {
    line: "Your self-assessment is saved as a draft and has not been submitted.",
    action: "Continue my assessment",
  },
  submitted: {
    line: "Your self-assessment has been submitted.",
    action: "View my assessment",
  },
  locked: {
    line: "Your self-assessment has been submitted and can no longer be changed.",
    action: "View my assessment",
  },
};

export default function SelfAssessmentPage() {
  const { user } = useAuth();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getSelfAssessment()
      .then((data) => !cancelled && setRecord(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const cycle = record?.cycle || null;
  const state = STATE[record?.status] || STATE.not_started;

  return (
    <>
      <PageHeader
        title="My self-assessment"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      {loading ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      ) : error ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      ) : !cycle ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center">
          <p className="text-ink">No cycle to assess against</p>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
            {user?.parGroup
              ? `The ${user.parGroup} group has no cycle running at the moment.`
              : "You are not in an appraisal group, so no cycle applies to you."}
          </p>
        </div>
      ) : !record.reviewId ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center">
          <p className="text-ink">Nothing to assess yet</p>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
            The {cycle.parGroup} {cycle.year} cycle is running, but you have no review in
            it.
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
            {state.line}{" "}
            {record.competencies?.length > 0 &&
              `It asks about ${record.competencies.length} competencies for ${user?.jobFamily}, and a short reflection.`}
          </p>

          <Link
            to="/my-self-assessment/form"
            className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {state.action}
          </Link>
        </div>
      )}

      <p className="mt-4 max-w-prose text-[13px] text-muted">
        Your supervisor cannot start their review of you until this is submitted.
      </p>
    </>
  );
}
