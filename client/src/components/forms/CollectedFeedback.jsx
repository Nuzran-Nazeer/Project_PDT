// What colleagues wrote about one person, for the supervisor writing from it.
//
// ⚠️ NOT RELEASED IS NOT THE SAME AS NOTHING WRITTEN, and the two are drawn differently
// on purpose. "Nothing has arrived" told where "nothing is released yet" is true is a
// false statement about somebody's own appraisal, and it invites a supervisor to write
// their review as though the colleague view were empty.
//
// ⚠️ Nothing here shows a name, a time or an order that means anything. The server sends
// a random label as the only handle and sorts by it, so position carries no information;
// rendering an index, a date or "first response" would put back what the server removed.

export default function CollectedFeedback({ collected }) {
  // ⚠️ Off the response, never worked out here. A rating is stored under a stable key
  // and the wording it stands for is the REVIEWEE's job family, which is not always the
  // supervisor's own.
  const nameFor = (key) =>
    (collected.competencies || []).find((c) => c.key === key)?.name || key;

  if (!collected.released) {
    return (
      <div className="rounded-lg border border-dashed border-line p-6 text-center">
        <p className="text-sm text-ink">Not released yet</p>
        <p className="mx-auto mt-2 max-w-prose text-[13px] text-muted">
          {collected.assignedCount === 0
            ? "No colleagues have been asked to review this person yet."
            : `${collected.submittedCount} of ${collected.assignedCount} have submitted. ${collected.needed} more before anything is shown.`}
        </p>
        <p className="mx-auto mt-2 max-w-prose text-[13px] text-muted">
          Responses are held back and released together. One arriving on its own could be
          matched to whoever was known to be writing it.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {collected.items.map((item) => (
        <article key={item.id} className="rounded-lg border border-line p-4">
          {item.ratings.map((rating) => (
            <div key={rating.competencyKey} className="mb-3 last:mb-0">
              <p className="text-[13px] font-medium text-ink">
                {nameFor(rating.competencyKey)}
                {rating.notObserved ? " · not observed" : ` · ${rating.score}`}
              </p>
              {rating.evidence && (
                <p className="mt-1 max-w-prose whitespace-pre-wrap text-[13px] text-muted">
                  {rating.evidence}
                </p>
              )}
            </div>
          ))}

          <FreeText label="Strength worth keeping" value={item.freeText?.strengths} />
          <FreeText label="What would help them grow" value={item.freeText?.development} />
        </article>
      ))}

      <p className="max-w-prose text-[13px] text-muted">
        {collected.complete
          ? `All ${collected.assignedCount} responses are in.`
          : `${collected.total} of ${collected.assignedCount} shown. The rest are released once everyone has submitted.`}{" "}
        No response here is attributed, and the order they appear in is not the order they
        arrived.
      </p>
    </div>
  );
}

function FreeText({ label, value }) {
  if (!value) return null;

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-[13px] font-medium text-ink">{label}</p>
      <p className="mt-1 max-w-prose whitespace-pre-wrap text-[13px] text-muted">
        {value}
      </p>
    </div>
  );
}
