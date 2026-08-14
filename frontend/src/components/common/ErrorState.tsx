import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this data. Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      data-testid="error-state"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-rose-200 bg-rose-50/50 text-rose-900',
        className
      )}
    >
      <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-subtle border border-rose-200">
        <AlertCircle className="w-7 h-7 stroke-[2]" />
      </div>
      <h3 className="text-base font-bold tracking-tight font-sans">
        {title}
      </h3>
      <p className="text-sm text-rose-700 mt-1 max-w-md leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          type="button"
          className="mt-5 inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold rounded-lg bg-white text-rose-700 border border-rose-300 shadow-xs hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 transition duration-150"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      )}
    </div>
  );
}
