import Icon from "../common/Icon";

export default function StatTile({ value, label, icon }) {
  return (
    <div className="rounded-xl border border-line bg-raised p-5">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted`}
        >
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <span className="truncate text-2xl font-semibold tracking-tight text-ink">
          {value}
        </span>
      </div>

      <p className="mt-3 text-[13px] text-muted">{label}</p>
    </div>
  );
}
