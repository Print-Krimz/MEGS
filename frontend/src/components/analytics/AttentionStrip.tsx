import React from "react";
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

const CHIP_BASE = "min-h-11 md:min-h-9 inline-flex items-center gap-1.5 border px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
const CHIP_TONE = {
  overdue: `${HEALTH_CHIP.overdue.className} hover:bg-[#FBE3E6]`,
  watch: `${HEALTH_CHIP.atRisk.className} hover:brightness-95`,
  // A zero count is never late or at risk, so it never takes the red or amber look.
  neutral: "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100",
};

/** What to act on first. Only items with a count show; each runs its action and scrolls to the records. */
export const AttentionStrip: React.FC<AttentionStripProps> = ({ items, embedded = false }) => {
  const shown = items.filter((i) => i.count > 0);
  return (
    <section aria-label="Needs action" className={embedded ? "" : "rounded-md border border-navy-line bg-white px-3.5 py-2.5"}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-700">Needs action</h2>
        {shown.length === 0 && <p className="text-xs font-sans text-slate-600">Nothing needs action right now.</p>}
        {shown.map((item) => {
          const tone = item.count === 0 ? "neutral" : (item.tone ?? "overdue");
          const chip = `${CHIP_BASE} ${CHIP_TONE[tone]}`;
          const inner = (
            <>
              <span className="tabular-nums text-sm">{item.count}</span>
              {item.label}
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
