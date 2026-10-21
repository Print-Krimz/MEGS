import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { useIsDesktop } from "../ta/application/useIsDesktop";

const RAIL_MIN = 35;
const RAIL_MAX = 60;
const KEY_STEP = 4;

const clamp = (n: number) => Math.min(RAIL_MAX, Math.max(RAIL_MIN, n));

const readStored = (key: string | undefined, fallback: number) => {
  if (!key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? clamp(n) : fallback;
  } catch {
    return fallback;
  }
};

const writeStored = (key: string | undefined, value: number) => {
  if (!key) return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable: the width resets next visit */
  }
};

const useMinWidth = (px: number) => {
  const [match, setMatch] = useState(() => (typeof window === "undefined" ? true : window.innerWidth >= px));
  useEffect(() => {
    const onResize = () => setMatch(window.innerWidth >= px);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [px]);
  return match;
};

export interface DetailLayoutProps {
  main: React.ReactNode;
  /** Side panel. Not rendered below 1024px: show it in a sheet from the caller. */
  rail?: React.ReactNode;
  /** Rail width as a percent of the layout. Default 42. */
  defaultRailPercent?: number;
  /** Adds a drag handle (1280px and wider). */
  resizable?: boolean;
  /** localStorage key that remembers the chosen width. */
  storageKey?: string;
  railLabel?: string;
  className?: string;
}

/** Two-pane detail view: main content on the left, a side panel (minimum 360px) on the right. */
export const DetailLayout: React.FC<DetailLayoutProps> = ({
  main,
  rail,
  defaultRailPercent = 42,
  resizable = false,
  storageKey,
  railLabel = "Side panel",
  className,
}) => {
  const isDesktop = useIsDesktop();
  const isWide = useMinWidth(1280);
  const showRail = Boolean(rail) && isDesktop;
  const canResize = resizable && showRail && isWide;

  const [percent, setPercent] = useState(() => readStored(storageKey, clamp(defaultRailPercent)));
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const latest = useRef(percent);
  latest.current = percent;

  const commit = useCallback((value: number) => writeStored(storageKey, Math.round(value)), [storageKey]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !containerRef.current) return;
    const box = containerRef.current.getBoundingClientRect();
    if (box.width <= 0) return;
    setPercent(clamp(((box.right - event.clientX) / box.width) * 100));
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    commit(latest.current);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    // The handle sits left of the rail: moving it left widens the rail.
    if (event.key === "ArrowLeft") next = latest.current + KEY_STEP;
    else if (event.key === "ArrowRight") next = latest.current - KEY_STEP;
    else if (event.key === "Home") next = RAIL_MIN;
    else if (event.key === "End") next = RAIL_MAX;
    if (next === null) return;
    event.preventDefault();
    const value = clamp(next);
    setPercent(value);
    commit(value);
  };

  if (!showRail) {
    return <div className={cn("min-w-0", className)}>{main}</div>;
  }

  const railPercent = canResize ? percent : clamp(defaultRailPercent);
  const columns = canResize
    ? "minmax(0,1fr) 12px minmax(360px,var(--rail-w))"
    : "minmax(0,1fr) minmax(360px,var(--rail-w))";

  return (
    <div
      ref={containerRef}
      className={cn("grid items-start", !canResize && "gap-6", className)}
      style={{ gridTemplateColumns: columns, ["--rail-w" as string]: `${railPercent}%` }}
    >
      <div className="min-w-0">{main}</div>
      {canResize && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${railLabel.toLowerCase()}`}
          aria-valuemin={RAIL_MIN}
          aria-valuemax={RAIL_MAX}
          aria-valuenow={Math.round(percent)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          className="group focus-ring mx-auto flex h-full min-h-24 w-3 cursor-col-resize touch-none justify-center rounded-sm"
        >
          <span className="h-full w-px bg-slate-300 group-hover:bg-navy group-focus-visible:bg-navy" />
        </div>
      )}
      <aside aria-label={railLabel} className="min-w-0">
        {rail}
      </aside>
    </div>
  );
};
