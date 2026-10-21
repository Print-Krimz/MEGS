import React from "react";
import { AlertTriangle, CheckCircle2, Circle, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { TA_STATUS_TONE_CLASSES, type TAStatusTone } from "../../lib/ta-copy";

export interface TimelineItem {
  id: string;
  /** Icon inside the rail node. Defaults to a plain dot. */
  icon?: LucideIcon;
  title: React.ReactNode;
  status: { label: string; tone: TAStatusTone };
  meta?: { label: string; value: React.ReactNode }[];
  body?: React.ReactNode;
  action?: React.ReactNode;
  /** "next" draws a dashed node and card for a step that has not happened yet. */
  variant?: "default" | "next";
}

export interface TimelineProps {
  items: TimelineItem[];
  ariaLabel?: string;
  className?: string;
}

// Each tone gets its own glyph so status never depends on colour alone.
const TONE_ICON: Record<TAStatusTone, LucideIcon> = {
  neutral: Circle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  brand: CheckCircle2,
};

/** Vertical rail of dated steps. Each step names its state with an icon and a word. */
export const Timeline: React.FC<TimelineProps> = ({ items, ariaLabel, className }) => (
  <ol aria-label={ariaLabel} className={cn("relative", className)}>
    {items.map((item, index) => {
      const Node = item.icon ?? Circle;
      const StatusIcon = TONE_ICON[item.status.tone];
      const isNext = item.variant === "next";
      const isLast = index === items.length - 1;
      return (
        <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
          {!isLast && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute bottom-0 left-[13px] top-7 w-px",
                isNext ? "border-l border-dashed border-slate-300" : "bg-slate-300",
              )}
            />
          )}
          <span
            aria-hidden="true"
            className={cn(
              "relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white text-slate-700",
              isNext ? "border-dashed border-slate-400 text-slate-500" : "border-slate-300",
            )}
          >
            <Node className="h-3.5 w-3.5" />
          </span>
          <div
            className={cn(
              "min-w-0 flex-1 rounded-md border p-3",
              isNext ? "border-dashed border-slate-300 bg-transparent" : "border-slate-300 bg-white",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <div className="min-w-0 text-sm font-semibold text-slate-950">{item.title}</div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium",
                  TA_STATUS_TONE_CLASSES[item.status.tone],
                )}
              >
                <StatusIcon className="h-3 w-3" aria-hidden="true" />
                {item.status.label}
              </span>
            </div>
            {item.meta && item.meta.length > 0 && (
              <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {item.meta.map((m) => (
                  <div key={m.label} className="flex min-w-0 gap-1.5">
                    <dt className="text-slate-600">{m.label}</dt>
                    <dd className="min-w-0 break-words text-slate-900">{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {item.body ? <div className="mt-2 text-sm text-slate-800">{item.body}</div> : null}
            {item.action ? <div className="mt-2.5 flex flex-wrap gap-2">{item.action}</div> : null}
          </div>
        </li>
      );
    })}
  </ol>
);
