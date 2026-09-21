import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listFlags, markFlagReviewed } from "../../services/monitoring";
import { formatDateTime } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/common/Icon";

// ⚠️ A flag names the officer it concerns and never a reviewer. It is raised from audit
// entries, which do not carry one either, so nothing here can render one into view.

const TYPE_LABELS = {
  reveal_threshold: "Too many reveals",
  improper_reveal: "Improper attempt",
  history_edit_in_active_cycle: "Record moved mid-cycle",
};

// The rule that fired, so the reader is not left working out why this is in front of them.
const TYPE_RULES = {
  reveal_threshold: "More than three identity reveals by one officer within one cycle.",
  improper_reveal:
    "A reveal attempted outside their coverage, inside their own reporting line, or without an HR role.",
  history_edit_in_active_cycle:
    "A unit, leadership or coverage date set inside a cycle that is being worked on.",
};

const primaryClass =
  "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass =
  "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const selectClass =
  "rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export default function MonitoringPage() {
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("open");
  const [reloads, setReloads] = useState(0);
  const [openRow, setOpenRow] = useState(null);

  useEffect(() => {
    let cancelled = false;

    listFlags({ status: status === "open" ? "" : status })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, reloads]);

  const items = data?.items || [];

  // The signed-in id arrives under either name depending on where the session came from.
  const me = String(user?._id ?? user?.id ?? "");

  const onStatus = (value) => {
    setLoading(true);
    setError("");
    setOpenRow(null);
    setStatus(value);
  };

  return (
    <>
      <PageHeader
        title="Monitoring"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <p className="mb-4 max-w-prose text-sm text-muted">
        A flag stays open until it is marked reviewed with a note.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="status" className="sr-only">
          Which flags
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => onStatus(e.target.value)}
          className={selectClass}
        >
          <option value="open">Open flags</option>
          <option value="reviewed">Reviewed flags</option>
          <option value="all">Open and reviewed</option>
        </select>

        {data && (
          <p className="text-[13px] text-muted">
            {items.length === 1 ? "1 flag" : items.length + " flags"}
            {status !== "open" && data.openCount > 0
              ? " · " + data.openCount + " open in total"
              : ""}
          </p>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      ) : loading ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
          {status === "reviewed"
            ? "Nothing has been marked reviewed yet."
            : status === "all"
              ? "Nothing has been flagged. The checks do not reach back before they were built."
              : "Nothing is open."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <Th>Raised</Th>
                <Th>Flag</Th>
                <Th>Officer</Th>
                <Th>Cycle</Th>
                <Th>Count</Th>
                <Th>Status</Th>
                <th className="w-10" />
              </tr>
            </thead>

            <tbody>
              {items.map((flag) => (
                <Flag
                  key={flag._id}
                  flag={flag}
                  expanded={openRow === flag._id}
                  onToggle={() => setOpenRow(openRow === flag._id ? null : flag._id)}
                  isOwn={String(flag.officerId?._id || flag.officerId) === me}
                  onDone={() => setReloads((n) => n + 1)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Flag({ flag, expanded, onToggle, isOwn, onDone }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = flag.status === "open";
  const panelId = `flag-${flag._id}`;

  const onMark = async () => {
    setBusy(true);
    setError("");
    try {
      await markFlagReviewed(flag._id, note);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-line last:border-0 hover:bg-surface"
      >
        <td className="px-4 py-3 whitespace-nowrap text-muted">
          {formatDateTime(flag.raisedAt)}
        </td>

        <td className="px-4 py-3 font-medium text-ink">
          {TYPE_LABELS[flag.type] || flag.type}
        </td>

        <td className="px-4 py-3">
          <span className="text-ink">
            {flag.officerId?.name || "No longer on record"}
          </span>
          {flag.officerId?.employeeId && (
            <span className="mt-0.5 block text-[12px] text-muted">
              {flag.officerId.employeeId}
            </span>
          )}
        </td>

        <td className="px-4 py-3 whitespace-nowrap text-muted">
          {flag.cycleId
            ? `${flag.cycleId.parGroup} ${flag.cycleId.year}`
            : "None resolved"}
        </td>

        {/* Only the reveal flag counts up to a line; the other two are incidents. */}
        <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted">
          {flag.threshold
            ? `${flag.count} of ${flag.threshold}`
            : flag.count === 1
              ? "Once"
              : `${flag.count} times`}
        </td>

        <td className="px-4 py-3">
          <span
            className={
              open
                ? "rounded-full border border-danger/40 bg-danger/10 px-2.5 py-0.5 text-[12px] font-medium text-danger"
                : "rounded-full border border-line px-2.5 py-0.5 text-[12px] font-medium text-muted"
            }
          >
            {open ? "Open" : "Reviewed"}
          </span>
        </td>

        <td className="px-2 py-3">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="sr-only">{expanded ? "Hide details" : "Show details"}</span>
            <Icon
              name="chevron"
              className={
                expanded
                  ? "h-4 w-4 rotate-90 transition-transform"
                  : "h-4 w-4 transition-transform"
              }
            />
          </button>
        </td>
      </tr>

      {expanded && (
        <tr id={panelId} className="border-b border-line last:border-0">
          <td colSpan={7} className="bg-surface px-4 py-4">
            <p className="max-w-prose text-sm text-ink">{flag.detail}</p>
            <p className="mt-1 max-w-prose text-[13px] text-muted">
              {TYPE_RULES[flag.type]}
            </p>
            <p className="mt-2 text-[12px] text-muted">
              Last seen {formatDateTime(flag.lastEventAt)}
            </p>

            {!open && (
              <div className="mt-3 max-w-prose rounded-lg border border-line bg-raised p-3">
                <p className="whitespace-pre-wrap text-[13px] text-ink">{flag.note}</p>
                <p className="mt-1.5 text-[12px] text-muted">
                  {flag.reviewedBy?.name || "No longer on record"} ·{" "}
                  {formatDateTime(flag.reviewedAt)}
                </p>
              </div>
            )}

            {open && isOwn && (
              <p className="mt-3 max-w-prose rounded-lg border border-line px-3 py-2.5 text-[13px] text-muted">
                This flag is about you, so you cannot mark it reviewed. It stays open.
              </p>
            )}

            {open && !isOwn && !asking && (
              <button
                type="button"
                className={`${secondaryClass} mt-3`}
                onClick={() => setAsking(true)}
              >
                Mark reviewed
              </button>
            )}

            {open && !isOwn && asking && (
              <div className="mt-3 max-w-prose rounded-lg border border-line bg-raised p-3">
                <label
                  htmlFor={`note-${flag._id}`}
                  className="mb-1.5 block text-[13px] font-semibold text-ink"
                >
                  What did you find?
                </label>
                <textarea
                  id={`note-${flag._id}`}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What you checked, and what it turned out to be."
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                />

                {error && (
                  <p
                    role="alert"
                    className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger"
                  >
                    {error}
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy || !note.trim()}
                    onClick={onMark}
                    className={primaryClass}
                  >
                    {busy ? "Saving…" : "Mark reviewed"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setAsking(false);
                      setNote("");
                      setError("");
                    }}
                    className={secondaryClass}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </th>
  );
}
