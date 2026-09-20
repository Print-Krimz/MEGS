import React from "react";
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

/** Accessible, responsive tabs shared by the TA workspace. */
export const Tabs: React.FC<TabsProps> = ({ items, value, onChange, ariaLabel, className }) => {
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
      role="tablist"
      aria-label={ariaLabel}
      className={cn("grid grid-cols-2 md:flex items-stretch border-b border-slate-300 bg-slate-100", className)}
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
              "min-h-11 min-w-0 flex items-center justify-start md:justify-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700",
              selected
                ? "bg-white text-teal-950 border-teal-800"
                : "border-transparent text-slate-600 hover:text-slate-950 hover:bg-slate-200/60"
            )}
          >
            {Icon && <Icon className={cn("w-4 h-4 shrink-0", selected ? "text-teal-700" : "text-slate-400")} />}
            <span className="min-w-0 text-left leading-tight break-words whitespace-normal">{item.label}</span>
            {item.badge && (
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold border",
                  item.badge.variant === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : item.badge.variant === "info"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
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
