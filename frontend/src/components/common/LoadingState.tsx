import { cn } from '../../lib/utils';

interface LoadingStateProps {
  variant?: 'card' | 'table' | 'detail' | 'page';
  rows?: number;
  className?: string;
}

export function LoadingState({
  variant = 'card',
  rows = 4,
  className,
}: LoadingStateProps) {
  if (variant === 'page') {
    return (
      <div data-testid="loading-state-page" className={cn('p-6 space-y-6 animate-pulse', className)}>
        <div className="h-8 w-64 bg-slate-200 rounded-md" />
        <div className="h-4 w-96 bg-slate-200 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div
        data-testid="loading-state-table"
        className={cn('w-full border border-border rounded-xl bg-card p-4 space-y-4 animate-pulse', className)}
      >
        <div className="h-10 bg-slate-100 rounded-lg w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <div className="h-5 w-1/4 bg-slate-100 rounded" />
            <div className="h-5 w-1/4 bg-slate-100 rounded" />
            <div className="h-5 w-1/4 bg-slate-100 rounded" />
            <div className="h-5 w-1/4 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div data-testid="loading-state-detail" className={cn('space-y-6 animate-pulse', className)}>
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-200 rounded" />
            <div className="h-4 w-32 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="h-20 bg-slate-200 rounded-xl" />
        <div className="h-80 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div
      data-testid="loading-state-card"
      className={cn('p-6 border border-border rounded-xl bg-card shadow-subtle space-y-4 animate-pulse', className)}
    >
      <div className="h-5 w-1/3 bg-slate-200 rounded" />
      <div className="h-4 w-full bg-slate-100 rounded" />
      <div className="h-4 w-2/3 bg-slate-100 rounded" />
    </div>
  );
}
