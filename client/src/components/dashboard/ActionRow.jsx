import { Link } from "react-router-dom";
import Icon from "../common/Icon";

// Light values are 700: at 13px a 600 on white is under 4.5:1 contrast.
const STATUS_TONES = {
  muted: "text-muted",
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-rose-700 dark:text-rose-400",
};

const ICON_TONES = {
  clipboard: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  message: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  file: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  trend: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  book: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  users: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  chart: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  check: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  key: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  briefcase: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  flag: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  list: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  shield: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  settings: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

export default function ActionRow({ tab, status = [] }) {
  return (
    <Link
      to={tab.path}
      className="flex items-center gap-4 rounded-xl border border-line bg-raised p-4 transition-colors hover:border-brand focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
          ICON_TONES[tab.icon] || ICON_TONES.users
        }`}
      >
        <Icon name={tab.icon} className="h-[18px] w-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{tab.title}</span>
        <span className="block truncate text-[13px] text-muted">{tab.description}</span>
      </span>

      {status.length > 0 && (
        <span className="hidden items-center gap-4 border-l border-line pl-4 md:flex">
          {status.map((item) => (
            <span
              key={item.text}
              className={`flex items-center gap-1.5 text-[13px] whitespace-nowrap ${
                STATUS_TONES[item.tone] || STATUS_TONES.muted
              }`}
            >
              <Icon name={item.icon} className="h-3.5 w-3.5" />
              {item.text}
            </span>
          ))}
        </span>
      )}

      <Icon name="chevron" className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}
