import { Link } from "react-router-dom";

// ⚠️ Not released is not the same as nothing written: "nothing has arrived" told where
// responses are merely held back invites a review written as though none exist.
//
// ⚠️ No name, no time, no order that means anything, and outstanding responses are a
// COUNT — a label seen waiting and later seen arriving is a submission time. (B17)

export default function CollectedFeedback({ collected, personId }) {
  if (!collected.released) {
    return (
      <div className="rounded-lg border border-dashed border-line p-6 text-center">
        <p className="text-sm text-ink">Not released yet</p>
        <p className="mx-auto mt-2 max-w-prose text-[13px] text-muted">
          {collected.assignedCount === 0
            ? "No colleagues have been asked yet."
            : `${collected.submittedCount} of ${collected.assignedCount} submitted. ${collected.needed} more before anything is shown.`}
        </p>
      </div>
    );
  }

  const outstanding = collected.assignedCount - collected.submittedCount;

  return (
    <div className="grid gap-3">
      {collected.items.map((item) => (
        <Link
          key={item.id}
          to={`/my-team/${personId}/feedback/${item.id}`}
          className="rounded-lg border border-line p-4 transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <p className="text-sm font-medium text-ink">{item.id}&rsquo;s feedback</p>
          <p className="mt-1 text-[13px] text-muted">{summarise(item)}</p>
        </Link>
      ))}

      <p className="text-[13px] text-muted">
        {collected.complete
          ? `All ${collected.assignedCount} in.`
          : `${collected.submittedCount} of ${collected.assignedCount} in, ${outstanding} to come.`}
      </p>
    </div>
  );
}

// Counts only. A snippet of the evidence here is the same text in two places, and the
// shorter copy is the one somebody quotes back at the person who wrote it.
function summarise(item) {
  const ratings = item.ratings || [];
  const declined = ratings.filter((rating) => rating.notObserved).length;

  return [`${ratings.length - declined} rated`, declined && `${declined} not observed`]
    .filter(Boolean)
    .join(" · ");
}
