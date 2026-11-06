import React from "react";
import { ArrowUpRight } from "lucide-react";
import { HEALTH_CHIP } from "../../lib/chart-palette";
import { scrollToId } from "../../lib/scroll-to";

export interface AttentionItem {
  key: string;
  count: number;
  /** Already worded for the count, e.g. "critical wait" for 1 and "critical waits" for 3. */
  label: string;
  /** Runs before scrolling, e.g. to open a tab and apply a filter. */
  onSelect?: () => void;
  /** "#id" scrolls to that section of this page. */
  href?: string;
  /** "overdue" (red) is for late work; "watch" (amber) is for items that need a look but are not late. Defaults to "overdue". */
  tone?: "overdue" | "watch";
}

interface AttentionStripProps {
  items: AttentionItem[];
  /** Sits inside another bordered block (the filter bar), so it draws no frame of its own. */
  embedded?: boolean;
}

const CHIP_BASE =
  "group min-h-11 md:min-h-9 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
const CHIP_TONE = {
  overdue: `${HEALTH_CHIP.overdue.className} hover:bg-[#FBE3E6] shadow-[0_1px_2px_0_rgb(180_35_24/0.08)]`,
  watch: `${HEALTH_CHIP.atRisk.className} hover:brightness-95 shadow-[0_1px_2px_0_rgb(122_72_0/0.08)]`,
  // A zero count is never late or at risk, so it never takes the red or amber look.
  neutral: "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100",
};

const COUNT_BADGE = {
  overdue: "bg-[#B42318] text-white",
  watch: "bg-[#9A5B00] text-white",
  neutral: "bg-slate-200 text-slate-700",
};

/** What to act on first. Only items with a count show; each runs its action and scrolls to the records. */
export const AttentionStrip: React.FC<AttentionStripProps> = ({ items, embedded = false }) => {
  const shown = items.filter((i) => i.count > 0);
  return (
    <section
      aria-label="Needs action"
      className={
        embedded
          ? ""
          : "rounded-lg border border-navy-line bg-white px-4 py-3 shadow-[0_1px_3px_0_rgb(15_23_42/0.06)]"
      }
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-600">Needs action</h2>
        {shown.length === 0 && (
          <p className="text-xs font-sans text-slate-600">
            Nothing needs action right now.
          </p>
        )}
        {shown.map((item) => {
          const tone = item.count === 0 ? "neutral" : (item.tone ?? "overdue");
          const chip = `${CHIP_BASE} ${CHIP_TONE[tone]}`;
          const inner = (
            <>
              <span className={`inline-flex min-w-5 items-center justify-center rounded-sm px-1.5 py-0.5 tabular-nums text-xs font-bold ${COUNT_BADGE[tone]}`}>
                {item.count}
              </span>
              <span>{item.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </>
          );
          const anchor = item.href?.startsWith("#") ? item.href.slice(1) : undefined;
          if (!item.href && !item.onSelect) {
            return (
              <span key={item.key} className={chip}>
                {inner}
              </span>
            );
          }
          return (
            <a
              key={item.key}
              href={item.href ?? "#"}
              onClick={(event) => {
                event.preventDefault();
                item.onSelect?.();
                // Let a newly opened tab render before scrolling to it.
                if (anchor) setTimeout(() => scrollToId(anchor), 0);
              }}
              className={chip}
            >
              {inner}
            </a>
          );
        })}
      </div>
    </section>
  );
};
