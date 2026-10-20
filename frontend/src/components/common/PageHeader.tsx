import React from "react";
import { cn } from "../../lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  /** Remove the bottom margin when the parent already spaces its children (space-y-*). */
  flush?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  flush = false,
}) => {
  return (
    <div className={cn("space-y-1.5 border-b border-slate-300 pb-3.5", !flush && "mb-5")}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 text-sm text-slate-600">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
                {item.href && !isLast ? (
                  <Link
                    to={item.href}
                    className="inline-flex min-h-11 items-center shrink-0 whitespace-nowrap hover:text-slate-900 transition-colors max-w-[280px] md:min-h-0 md:py-0.5"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={isLast ? "page" : undefined} className={isLast ? "text-slate-900 font-semibold truncate min-w-0 max-w-[200px] sm:max-w-[320px]" : "shrink-0 whitespace-nowrap max-w-[280px]"}>
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-950 break-words">
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="text-sm text-slate-600 max-w-3xl leading-normal">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
