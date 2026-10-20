import React, { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  panelId?: string;
  badge?: { text: string; variant?: "success" | "warning" | "info" };
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Accessible tabs: a single horizontally scrollable row at every width.
 * Selected = navy underline + semibold text; focus = a separate inset ring.
 */
export const Tabs: React.FC<TabsProps> = ({ items, value, onChange, ariaLabel, className }) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the selected tab visible when it changes (keyboard, deep link).
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!list || !selected) return;
    const left = selected.offsetLeft;
    const right = left + selected.offsetWidth;
    if (left < list.scrollLeft) list.scrollLeft = Math.max(0, left - 8);
    else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth + 8;
  }, [value]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(
      event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []
    );
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex < 0) return;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
      ? buttons.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.click();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-nowrap items-stretch overflow-x-auto overscroll-x-contain border-b border-slate-300 bg-slate-100 [scrollbar-width:thin]",
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={item.panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy",
              selected
                ? "border-navy bg-white font-semibold text-navy"
                : "border-transparent font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-950"
            )}
          >
            {Icon && <Icon className={cn("h-4 w-4 shrink-0", selected ? "text-navy" : "text-slate-400")} />}
            <span>{item.label}</span>
            {item.badge && (
              <span
                className={cn(
                  "shrink-0 text-xs font-semibold tabular-nums",
                  item.badge.variant === "success"
                    ? "text-emerald-700"
                    : item.badge.variant === "info"
                    ? "text-navy"
                    : "text-amber-700"
                )}
              >
                {item.badge.text}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
