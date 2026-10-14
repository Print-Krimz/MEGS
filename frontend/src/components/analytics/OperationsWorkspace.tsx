import React, { useRef } from "react";

export interface WorkspaceTab<K extends string = string> {
  key: K;
  label: string;
  /** Shorter wording for a phone, where three full labels do not fit. The full label is still the accessible name. */
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
  /** Anchor id for scrolling to the workspace. */
  id?: string;
}

/** One framed workspace with a tab for each long list, so the page does not stack three lists one under another. */
export function OperationsWorkspace<K extends string>({ tabs, active, onChange, id = "operations" }: OperationsWorkspaceProps<K>) {
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
    <section id={id} aria-label="Operations workspace" className="scroll-mt-4 border border-slate-300 bg-white">
      <div role="tablist" aria-label="Lists to work through" className="flex overflow-x-auto border-b border-slate-300 bg-slate-100">
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
              aria-label={`${tab.label} ${tab.count}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`min-h-11 flex-1 sm:flex-none sm:shrink-0 border-r border-slate-300 px-4 text-sm font-semibold font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0B315D] ${
                selected ? "bg-white text-slate-950 border-b-2 border-b-[#0B315D] -mb-px" : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span className={tab.shortLabel ? "hidden sm:inline" : undefined}>{tab.label}</span>
              {tab.shortLabel && <span className="sm:hidden">{tab.shortLabel}</span>}{" "}
              <span className="ml-1 tabular-nums text-xs font-normal">{tab.count}</span>
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" id={`${id}-panel-${tab.key}`} aria-labelledby={`${id}-tab-${tab.key}`} hidden={tab.key !== active} className="max-h-[36rem] overflow-y-auto">
          {tab.content}
        </div>
      ))}
    </section>
  );
}
