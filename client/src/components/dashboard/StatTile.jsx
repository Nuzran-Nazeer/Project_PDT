import Icon from "../common/Icon";

// A tile does not know whether its value is real. The dashboard decides that.
//
// The tones are the only place this codebase uses palette colours rather than the
// semantic tokens, because four tiles in one colour stop being scannable. Light stays
// at 700: a 600 on white is under the contrast a small glyph needs.
const TONES = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

export default function StatTile({ value, label, icon, tone = "blue" }) {
  return (
    <div className="rounded-xl border border-line bg-raised p-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${TONES[tone] || TONES.blue}`}>
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
