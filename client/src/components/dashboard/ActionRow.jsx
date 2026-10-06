import { Link } from "react-router-dom";
import Icon from "../common/Icon";

// Light values are 700: at 13px a 600 on white is under 4.5:1 contrast.
const STATUS_TONES = {
  muted: "text-muted",
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-rose-700 dark:text-rose-400",
};

export default function ActionRow({ tab, status = [] }) {
  return (
    <Link
      to={tab.path}
      className="flex items-center gap-4 rounded-xl border border-line bg-raised p-4 transition-colors hover:border-muted focus-visible:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-muted">
        <Icon name={tab.icon} className="h-[18px] w-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{tab.title}</span>
        <span className="mt-1 block text-[13px] leading-relaxed text-muted">
          {tab.description}
        </span>
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

      {!tab.built && (
        <span className="rounded border border-line px-2 py-1 text-[10px] text-muted">
          Pending
        </span>
      )}
      <Icon name="chevron" className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}
