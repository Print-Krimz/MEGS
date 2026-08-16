import React from "react";
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
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
}) => {
  return (
    <div className="mb-5 space-y-1.5 border-b border-slate-300 pb-3.5">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
                {item.href && !isLast ? (
                  <Link
                    to={item.href}
                    className="hover:text-slate-900 transition-colors uppercase tracking-wider truncate max-w-[150px]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-slate-900 font-bold uppercase tracking-wider truncate max-w-[200px]" : "uppercase tracking-wider truncate max-w-[150px]"}>
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
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-950 font-mono uppercase">
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="text-xs text-slate-600 max-w-3xl leading-normal font-sans">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
