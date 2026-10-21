import React, { useRef } from "react";
import { cn } from "../../lib/utils";
import { useScrollFade } from "./Tabs";

export interface FilterTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "warning" | "danger";
  selected?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

const valueTone: Record<NonNullable<FilterTileProps["tone"]>, string> = {
  neutral: "text-slate-950",
  warning: "text-amber-800",
  danger: "text-rose-700",
};

/** One stat that doubles as a queue filter. Selected = soft navy fill + left bar. */
export const FilterTile: React.FC<FilterTileProps> = ({
  label,
  value,
  hint,
  tone = "neutral",
  selected = false,
  onClick,
  ariaLabel,
  className,
}) => {
  const classes = cn(
    "relative flex min-h-[4.5rem] w-full min-w-[9.5rem] shrink-0 flex-col items-start justify-center gap-0.5 border px-4 py-2.5 text-left md:min-w-0",
    selected ? "border-navy/40 bg-navy-soft" : "border-slate-300 bg-white",
    onClick && !selected && "hover:bg-slate-50",
    onClick && "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2",
    className
  );
  const content = (
    <>
      {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-navy" />}
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <span className={cn("text-2xl font-semibold leading-none tabular-nums", valueTone[tone])}>{value}</span>
      {hint && <span className="max-w-full truncate text-xs text-slate-500">{hint}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} aria-label={ariaLabel} className={classes}>
        {content}
      </button>
    );
  }
  return (
    <div className={classes} aria-label={ariaLabel}>
      {content}
    </div>
  );
};

/** Grid on md+, horizontally scrolling chip row below md (fades at the overflowing edge). */
export const FilterTileRow: React.FC<{
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4 | 5;
}> = ({ children, className, columns = 4 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const fadeStyle = useScrollFade(ref, [React.Children.count(children)]);
  return (
    <div
      ref={ref}
      style={fadeStyle}
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0 [scrollbar-width:thin]",
        columns === 2 && "md:grid-cols-2",
        columns === 3 && "md:grid-cols-3",
        columns === 4 && "md:grid-cols-2 lg:grid-cols-4",
        columns === 5 && "md:grid-cols-3 lg:grid-cols-5",
        className
      )}
    >
      {children}
    </div>
  );
};
