import Icon from "../common/Icon";

export default function IdentityCard({ name, roleLabel, employeeId, wide = false }) {
  return (
    <div
      className={`flex h-full flex-wrap items-center gap-4 rounded-xl border border-line bg-raised p-5 sm:gap-6 sm:p-7 ${wide ? "" : "flex-nowrap"}`}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-xl font-bold text-ink sm:h-16 sm:w-16">
        {initials(name)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-2xl font-semibold tracking-tight text-ink">
          {greeting()}, {name}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {roleLabel && <Chip icon="briefcase">{roleLabel}</Chip>}
          {!wide && employeeId && <Chip icon="user">{employeeId}</Chip>}
          {!wide && <Chip icon="calendar">{today()}</Chip>}
        </div>
      </div>
      {wide && (
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-line pt-4 md:w-auto md:flex-col md:items-end md:gap-3 md:border-t-0 md:border-l md:pl-6 md:pt-0">
          <Chip icon="calendar">{today()}</Chip>
          {employeeId && <Chip icon="user">{employeeId}</Chip>}
        </div>
      )}
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
