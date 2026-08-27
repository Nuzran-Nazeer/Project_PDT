import Icon from "../common/Icon";
import { formatDate } from "../../utils/dates";

// The cycle banner beside the greeting: which appraisal cycle the person's group is
// in, and where it has got to.
//
// IT IS REAL NOW. It reads GET /cycles/current, which takes no arguments and answers
// from the signed in person's own record. Until 2026-08-27 every word of this card was
// invented, and it is the first part of the employee dashboard's first criterion to
// stop being a placeholder.
//
// ⚠️ THERE IS NO PROGRESS BAR, AND ITS ABSENCE IS DELIBERATE. The old placeholder drew
// one, and a bar is a claim: it says a proportion of something has been completed.
// Nothing measures that yet -- there are no reviews, no feedback and no
// self-assessments -- so any figure in it would be invented, and a bar sitting at
// nought would say "the cycle is running and nobody has done anything", which is a
// different and false statement. The stage name IS the progress: a cycle at
// "Collecting" tells a reader exactly where it is.
//
// NULL IS A REAL ANSWER. For most of the year a group is between cycles, and a draft
// does not count because it has not opened. Those are different sentences from "no
// cycle has ever been created", and this card says which.

const STAGE_LABELS = {
  open: "Open",
  collecting: "Collecting",
  supervisor_review: "Supervisor review",
  normalising: "Normalising",
  published: "Published",
};

export default function CycleCard({ cycle, parGroup, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-line p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          Appraisal cycle
        </p>
        <p className="mt-2 text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="rounded-xl border border-dashed border-line p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          Appraisal cycle
        </p>
        {/* Two different sentences, because they mean different things to the reader.
            Somebody with no appraisal group is not waiting for a cycle at all -- they
            belong to no unit, so nobody supervises them and they are not appraised. */}
        <p className="mt-2 text-sm text-muted">
          {parGroup
            ? `The ${parGroup} group has no cycle running at the moment.`
            : "You are not in an appraisal group, so no cycle applies to you."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 dark:bg-emerald-500/[0.08]">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <Icon name="target" className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">
            {cycle.parGroup} group · {cycle.year}
          </p>
          <p className="truncate text-[13px] text-muted">
            {formatDate(cycle.startDate)} to {formatDate(cycle.endDate)}
          </p>
        </div>

        {/* The stage, standing where the progress bar used to. It is the one honest
            statement of where the cycle has got to. */}
        <div className="shrink-0">
          <p className="text-[13px] text-muted">Stage</p>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {STAGE_LABELS[cycle.status] || cycle.status}
          </p>
        </div>
      </div>
    </div>
  );
}
