import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export interface RecordBreadcrumbItem {
  label: string;
  href?: string;
}

/** Breadcrumb above a RecordSummary, whose title is the page's h1. */
export const RecordBreadcrumb: React.FC<{ items: RecordBreadcrumbItem[] }> = ({ items }) => (
  <>
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 text-sm text-slate-600">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />}
            {item.href && !last ? (
              <Link to={item.href} className="inline-flex min-h-11 items-center whitespace-nowrap hover:text-slate-900 md:min-h-0 md:py-0.5">
                {item.label}
              </Link>
            ) : (
              <span aria-current={last ? "page" : undefined} className="min-w-0 max-w-[200px] truncate font-semibold text-slate-900 sm:max-w-[320px]">
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  </>
);
