// ⚠️ `editable` is the server's answer and nothing here recomputes it. The time left is
// display only and does not tick: a late write is refused with a 409 whatever this says.

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

const timeLeft = (locksAt) => {
  const minutes = Math.floor((new Date(locksAt).getTime() - Date.now()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return "";
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? "" : "s"} left`;
  const hours = Math.floor(minutes / 60);
  return `about ${hours} hour${hours === 1 ? "" : "s"} left`;
};

export default function EditWindowNotice({ submittedAt, locksAt, editable }) {
  if (!submittedAt) return null;

  const box = "rounded-xl border p-4 text-[13px]";

  if (!editable) {
    return (
      <div className={`${box} border-line bg-raised`} role="status">
        <p className="font-semibold text-ink">Locked. This can no longer be changed.</p>
        <p className="mt-1 max-w-prose text-muted">
          Submitted {formatDateTime(submittedAt)}
          {locksAt && <>, corrections closed {formatDateTime(locksAt)}</>}.
        </p>
      </div>
    );
  }

  const left = timeLeft(locksAt);

  return (
    <div className={`${box} border-brand/40 bg-brand/5`} role="status">
      <p className="font-semibold text-ink">
        Submitted, and still correctable{left && <>: {left}</>}
      </p>
      <p className="mt-1 max-w-prose text-muted">
        Sent {formatDateTime(submittedAt)}
        {locksAt && <>. It locks {formatDateTime(locksAt)}</>}, after which nothing on it
        can change.
      </p>
    </div>
  );
}
