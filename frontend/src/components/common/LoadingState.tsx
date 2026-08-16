import React from "react";
import { cn } from "../../lib/utils";

export interface LoadingStateProps {
  variant?: "table" | "cards" | "detail" | "spinner";
  rows?: number;
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = "table",
  rows = 5,
  message = "Loading operational data...",
  className,
}) => {
  if (variant === "spinner") {
    return (
      <div className={cn("py-12 flex flex-col items-center justify-center gap-3", className)}>
        <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent animate-spin" />
        <span className="text-xs font-mono text-slate-500">{message}</span>
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 my-3", className)}>
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="bg-white p-4 border border-slate-300 space-y-2.5 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 bg-slate-200 w-1/2" />
              <div className="h-4 bg-slate-200 w-14" />
            </div>
            <div className="h-3 bg-slate-100 w-3/4" />
            <div className="h-3 bg-slate-100 w-1/3" />
            <div className="pt-2.5 border-t border-slate-100 flex justify-between">
              <div className="h-3 bg-slate-100 w-20" />
              <div className="h-3 bg-slate-100 w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={cn("space-y-4 my-3 animate-pulse", className)}>
        {/* Header Skeleton */}
        <div className="bg-white p-5 border border-slate-300 space-y-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5 w-1/3">
              <div className="h-5 bg-slate-200 w-3/4" />
              <div className="h-3.5 bg-slate-100 w-1/2" />
            </div>
            <div className="h-7 bg-slate-200 w-24" />
          </div>
          <div className="h-8 bg-slate-100 w-full" />
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white p-5 border border-slate-300 space-y-3">
            <div className="h-4 bg-slate-200 w-1/4" />
            <div className="h-16 bg-slate-50 w-full border border-slate-200" />
            <div className="h-24 bg-slate-50 w-full border border-slate-200" />
          </div>
          <div className="bg-white p-5 border border-slate-300 space-y-3">
            <div className="h-4 bg-slate-200 w-1/2" />
            <div className="h-3.5 bg-slate-100 w-full" />
            <div className="h-3.5 bg-slate-100 w-3/4" />
            <div className="h-3.5 bg-slate-100 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // Default: Table skeleton
  return (
    <div className={cn("w-full bg-white border border-slate-300 overflow-hidden my-3 animate-pulse", className)}>
      <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 flex justify-between">
        <div className="h-3.5 bg-slate-300 w-1/4" />
        <div className="h-3.5 bg-slate-300 w-1/6" />
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="px-4 py-3 flex items-center justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="h-3.5 bg-slate-200 w-1/3" />
              <div className="h-3 bg-slate-100 w-1/4" />
            </div>
            <div className="h-4 bg-slate-100 w-16 shrink-0" />
            <div className="h-3.5 bg-slate-200 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};
