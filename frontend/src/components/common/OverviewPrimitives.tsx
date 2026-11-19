import React from "react";
import { Link } from "@tanstack/react-router";
import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import { ErrorState } from "./ErrorState";

const DEFAULT_SECTION_SKELETON = (
  <div className="space-y-3 p-3.5">
    <div className="h-4 w-1/2 bg-slate-200" />
    <div className="h-3 w-3/4 bg-slate-100" />
  </div>
);

export interface OverviewSectionDataProps<T> {
  query: UseQueryResult<T>;
  subject: string;
  skeleton?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}

/**
 * Shared async section wrapper for overview panels: shows a compact inline
 * retry banner on failure, a pulse skeleton while loading/refetching errors,
 * and renders children only once data is available.
 */
export function OverviewSectionData<T>({
  query,
  subject,
  skeleton,
  children,
}: OverviewSectionDataProps<T>) {
  if (query.isError && !query.isFetching) {
    return (
      <ErrorState
        compact
        subject={subject}
        error={query.error as Error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (query.isPending || query.isError) {
    return (
      <div role="status" aria-label="Loading section" className="motion-safe:animate-pulse">
        {skeleton ?? DEFAULT_SECTION_SKELETON}
        <span className="sr-only">Loading information</span>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

export interface OverviewMetricValueProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => React.ReactNode;
}

/**
 * Metric tile value wrapper: shows a skeleton while loading and an inline
 * "—" + retry control on failure so unavailable counts never read as 0.
 */
export function OverviewMetricValue<T>({
  query,
  children,
}: OverviewMetricValueProps<T>) {
  if (query.isPending || (query.isError && query.isFetching)) {
    return (
      <div
        role="status"
        aria-label="Loading metric"
        className="mt-1 h-7 w-16 bg-slate-200 motion-safe:animate-pulse"
      />
    );
  }
  if (query.isError) {
    return (
      <span className="inline-flex min-h-8 items-center gap-2">
        <span className="text-2xl font-semibold text-slate-600" aria-hidden="true">
          —
        </span>
        <span className="sr-only">Unavailable</span>
        <button
          type="button"
          onClick={() => {
            void query.refetch();
          }}
          className="relative z-10 min-h-11 px-1 text-xs font-medium text-slate-900 underline hover:text-slate-950 md:min-h-0 focus-ring"
        >
          Try again
        </button>
      </span>
    );
  }
  return <>{children(query.data)}</>;
}

export interface OverviewMetricTileProps {
  label: string;
  to?: string;
  search?: Record<string, string>;
  caption?: React.ReactNode;
  tone?: "default" | "alert";
  children: React.ReactNode;
}

/**
 * Slim KPI tile for overview grids. When `to` is provided, the label link
 * stretches across the tile via `after:inset-0` for a single keyboard tab stop.
 */
export const OverviewMetricTile: React.FC<OverviewMetricTileProps> = ({
  label,
  to,
  search,
  caption,
  tone = "default",
  children,
}) => (
  <div
    className={cn(
      "relative bg-white px-3.5 py-3",
      to &&
        "transition-colors hover:bg-slate-50 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset has-[a:focus-visible]:ring-focus"
    )}
  >
    {to ? (
      <Link
        to={to}
        search={search as never}
        className="block text-xs font-medium text-slate-600 outline-none after:absolute after:inset-0 after:content-['']"
      >
        {label}
      </Link>
    ) : (
      <span className="block text-xs font-medium text-slate-600">{label}</span>
    )}
    <div
      className={cn(
        "mt-0.5 font-display text-2xl font-semibold leading-8 tabular-nums",
        tone === "alert" ? "text-rose-700" : "text-slate-950"
      )}
    >
      {children}
    </div>
    {caption !== undefined && caption !== null && (
      <div className="mt-0.5 truncate text-xs text-slate-600">{caption}</div>
    )}
  </div>
);

export interface OverviewPanelHeaderProps {
  id?: string;
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Panel header bar shared across TA and Admin overview sections.
 */
export const OverviewPanelHeader: React.FC<OverviewPanelHeaderProps> = ({
  id,
  title,
  meta,
  action,
}) => (
  <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-100 px-3.5 py-1.5">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <h2 id={id} className="text-sm font-semibold text-slate-950">
        {title}
      </h2>
      {meta}
    </div>
    {action}
  </div>
);
