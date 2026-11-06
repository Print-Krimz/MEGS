import React, { useRef } from "react";

export interface WorkspaceTab<K extends string = string> {
  key: K;
  label: string;
  /** Shorter wording for a phone, where three full labels do not fit. From md up the full label shows. */
  shortLabel?: string;
  /** Number shown on the tab, e.g. how many records it lists. */
  count: number;
  /** Rendered once and kept, so each tab keeps its own search, filters and page when another tab is open. */
  content: React.ReactNode;
}

interface OperationsWorkspaceProps<K extends string> {
  tabs: WorkspaceTab<K>[];
  active: K;
  onChange: (key: K) => void;
  /** Show each list's count on its tab. Turn off where another element already shows the same numbers. */
  showCounts?: boolean;
  /** Anchor id for scrolling to the workspace. */
  id?: string;
  /** Shown above the tabs, so it stays visible whichever tab is open. */
  banner?: React.ReactNode;
}

/** One framed workspace with a tab for each long list, so the page does not stack three lists one under another. */
export function OperationsWorkspace<K extends string>({ tabs, active, onChange, showCounts = true, id = "operations", banner }: OperationsWorkspaceProps<K>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].key);
    refs.current[tabs[next].key]?.focus();
  };

  return (
    <section
      id={id}
      aria-label="Operations workspace"
      className="scroll-mt-4 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_1px_3px_0_rgb(15_23_42/0.06),0_1px_2px_-1px_rgb(15_23_42/0.04)]"
    >
      <div aria-hidden="true" className="h-1 w-full bg-navy" />
      {banner}
      <div
        role="tablist"
        aria-label="Lists to work through"
        className="flex overflow-x-auto border-b border-slate-300 bg-gradient-to-b from-[#F1F5F9] to-[#E9EEF5] px-2 pt-2 gap-1"
      >
        {tabs.map((tab, index) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                refs.current[tab.key] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`min-h-11 inline-flex flex-1 sm:flex-none sm:shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-t-md px-2.5 sm:px-4 text-xs sm:text-sm font-semibold font-sans transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${
                selected
                  ? "relative z-10 -mb-px border border-b-0 border-slate-300 bg-white text-navy shadow-[0_-1px_2px_0_rgb(15_23_42/0.04)]"
                  : "border border-transparent text-slate-600 hover:bg-white/60 hover:text-slate-900"
              }`}
            >
              {tab.shortLabel ? (
                <>
                  <span className="md:hidden">{tab.shortLabel}</span>
                  <span className="hidden md:inline">{tab.label}</span>
                </>
              ) : (
                tab.label
              )}{" "}
              {showCounts && (
                <span
                  className={`inline-flex items-center justify-center rounded-full px-1.5 sm:px-2 py-0.5 tabular-nums text-xs ${
                    selected ? "bg-navy font-bold text-white" : "bg-slate-200/90 font-semibold text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${id}-panel-${tab.key}`}
          aria-labelledby={`${id}-tab-${tab.key}`}
          hidden={tab.key !== active}
          tabIndex={-1}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}
