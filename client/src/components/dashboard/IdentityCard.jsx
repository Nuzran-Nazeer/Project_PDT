import Icon from "../common/Icon";

export default function IdentityCard({ name, roleLabel, employeeId }) {
  return (
    <div className="flex h-full items-center gap-6 rounded-xl border border-line bg-raised p-7">
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand text-xl font-bold text-white">
        {initials(name)}
      </span>

      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold tracking-tight text-ink">
          {greeting()}, {name}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {roleLabel && <Chip icon="briefcase">{roleLabel}</Chip>}
          {employeeId && <Chip icon="user">{employeeId}</Chip>}
          <Chip icon="calendar">{today()}</Chip>
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, children }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-muted">
      <Icon name={icon} className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Not a locale format, so the date reads the same on every machine.
function today() {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
