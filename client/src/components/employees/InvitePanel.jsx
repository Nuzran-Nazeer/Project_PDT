import { useState } from "react";
import { createInvite } from "../../services/invite";
import { formatDate } from "../../utils/dates";

// The HR half of the invite, on the record it belongs to.
//
// It lives here rather than on a screen of its own because generating an invite needs
// the record's id, and finding the right person IS the roster. A standalone invite
// form would have to grow its own employee search, which is this list built twice.
//
// THE CODE IS SHOWN ONCE AND IS NOT RECOVERABLE. The database keeps a hash of it, so
// nothing on the server can ever display it again. Losing it means issuing a new one,
// which is also how an invite is cancelled: the new hash replaces the old and the
// previous code stops matching anything.

// Clipboard access can fail: an insecure origin, a browser that blocks it, a denied
// permission. The code stays selectable on screen either way, so a failure costs a
// manual selection rather than the invite.
const copy = async (text, onDone) => {
  try {
    await navigator.clipboard.writeText(text);
    onDone(true);
  } catch {
    onDone(false);
  }
};

function CopyButton({ value, label }) {
  const [state, setState] = useState("");

  const handleClick = () =>
    copy(value, (ok) => {
      setState(ok ? "Copied" : "Press Ctrl+C");
      setTimeout(() => setState(""), 2000);
    });

  return (
    <button
      type="button"
      onClick={handleClick}
      className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-brand"
    >
      {state || label}
    </button>
  );
}

export default function InvitePanel({ person, onIssued }) {
  const [issued, setIssued] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  // `inviteExpiresAt` comes back on the record; the token itself never does. So HR can
  // see that an invite is outstanding and when it lapses, without the code being
  // recoverable — which is exactly the split the design asks for.
  const outstanding =
    person.inviteExpiresAt && new Date(person.inviteExpiresAt) > new Date();

  const handleGenerate = async () => {
    setWorking(true);
    setError("");
    try {
      const result = await createInvite(person._id);
      setIssued(result);
      onIssued?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  const buttonLabel = outstanding ? "Generate a new code" : "Generate invite code";

  return (
    <div className="mt-8 rounded-xl border border-line bg-raised p-5">
      <p className="text-sm font-medium text-ink">Invite</p>

      {!issued && (
        <>
          <p className="mt-1 text-[13px] text-muted">
            {outstanding
              ? `A code was issued and works until ${formatDate(person.inviteExpiresAt)}. It cannot be shown again — generating a new one replaces it, and the old code stops working.`
              : "Creates a one-time code and an email for you to send. The system sends nothing itself."}
          </p>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={working}
            className="mt-4 cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working ? "Generating…" : buttonLabel}
          </button>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
        >
          {error}
        </p>
      )}

      {issued && (
        <div className="mt-4">
          <p
            role="status"
            className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-[13px] text-ink"
          >
            Copy this before leaving the page. It is stored as a hash, so nothing can show
            it to you again — if it is lost, generate a new one.
          </p>

          <div className="mt-4">
            <div className="flex items-center gap-3">
              <p className="text-[13px] font-semibold text-ink">
                Code · expires {formatDate(issued.expiresAt)}
              </p>
              <CopyButton value={issued.code} label="Copy code" />
            </div>
            <p className="mt-1.5 rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-[12px] break-all text-ink">
              {issued.code}
            </p>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-3">
              <p className="text-[13px] font-semibold text-ink">Email to send</p>
              <CopyButton value={issued.emailBody} label="Copy email" />
            </div>
            <pre className="mt-1.5 overflow-x-auto rounded-lg border border-line bg-surface px-3 py-2.5 text-[12px] whitespace-pre-wrap text-muted">
              {issued.emailBody}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
