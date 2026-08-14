import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  badge?: ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  badge,
}: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-card px-6 py-5 shadow-subtle mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm font-medium text-slate-500 mb-2">
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <div key={index} className="flex items-center space-x-1">
                    {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    {item.href && !isLast ? (
                      <Link
                        to={item.href}
                        className="text-sm font-medium text-slate-500 hover:text-slate-900 transition duration-150"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className={isLast ? 'text-slate-900 font-semibold' : 'text-slate-500'}>
                        {item.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {title}
            </h1>
            {badge && <div className="flex items-center">{badge}</div>}
          </div>

          {description && (
            <p className="text-sm text-slate-600 leading-normal mt-1">
              {description}
            </p>
          )}
        </div>

        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
