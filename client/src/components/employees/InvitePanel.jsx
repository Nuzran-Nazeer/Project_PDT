import { useState } from "react";
import { createInvite } from "../../services/invite";
import { formatDate } from "../../utils/dates";

// ⚠️ The link is shown once and is not recoverable: the database keeps a hash. Re-issuing
// replaces it, which is also how an invite is cancelled.

// Clipboard access can fail; the link stays selectable on screen either way.
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

  // `inviteExpiresAt` comes back on the record; the token itself never does.
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

  const buttonLabel = outstanding ? "Generate a new link" : "Generate invite link";

  return (
    <div className="mt-8 rounded-xl border border-line bg-raised p-5">
      <p className="text-sm font-medium text-ink">Invite</p>

      {!issued && (
        <>
          <p className="mt-1 text-[13px] text-muted">
            {outstanding
              ? `A link was issued and works until ${formatDate(person.inviteExpiresAt)}. It cannot be shown again. Generating a new one replaces it, and the old link stops working.`
              : "Creates a one-time link and an email for you to send. The system sends nothing itself."}
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
            Copy this before leaving the page: it cannot be shown again. If it is lost,
            generate a new one.
          </p>

          <div className="mt-4">
            <div className="flex items-center gap-3">
              <p className="text-[13px] font-semibold text-ink">
                Invite link · expires {formatDate(issued.expiresAt)}
              </p>
              <CopyButton value={issued.link} label="Copy link" />
            </div>
            <p className="mt-1.5 rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-[12px] break-all text-ink">
              {issued.link}
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
