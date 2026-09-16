import ResponseCard from "./ResponseCard";
import { summariseRatings } from "../../utils/ratingSummary";

// ⚠️ No name, no time, and outstanding responses are a count: a label seen waiting and
// later seen arriving is a submission time (B17).

export default function CollectedFeedback({ collected, personId }) {
  if (!collected.released) {
    // ⚠️ Below the minimum there is no colleague section at all, however many reply.
    const belowMinimum = collected.reason === "below_minimum";

    return (
      <div className="rounded-lg border border-dashed border-line p-6 text-center">
        <p className="text-sm text-ink">
          {belowMinimum ? "No colleague section" : "Not released yet"}
        </p>
        <p className="mx-auto mt-2 max-w-prose text-[13px] text-muted">
          {collected.assignedCount === 0
            ? "No colleagues have been asked yet."
            : belowMinimum
              ? `Only ${collected.assignedCount} were asked and the minimum is ${collected.minimum}, so nothing is shown.`
              : `${collected.settledCount} of ${collected.assignedCount} in. ${collected.needed} more before anything is shown.`}
        </p>
      </div>
    );
  }

  const outstanding = collected.assignedCount - collected.settledCount;

  return (
    <div className="grid gap-3">
      {collected.items.map((item) => (
        <ResponseCard
          key={item.id}
          to={`/my-team/${personId}/feedback/${item.id}`}
          title={`${item.id}'s feedback`}
          summary={summariseRatings(item.ratings)}
        />
      ))}

      <p className="text-[13px] text-muted">
        {collected.complete
          ? `All ${collected.assignedCount} in.`
          : `${collected.settledCount} of ${collected.assignedCount} in, ${outstanding} to come.`}
      </p>
    </div>
  );
}
