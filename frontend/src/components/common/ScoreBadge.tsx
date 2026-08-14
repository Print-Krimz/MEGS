import { cn } from '../../lib/utils';
import { Sparkles } from 'lucide-react';

interface ScoreBadgeProps {
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showBar?: boolean;
  className?: string;
}

export function ScoreBadge({
  score,
  size = 'md',
  showIcon = false,
  showBar = false,
  className,
}: ScoreBadgeProps) {
  if (score === null || score === undefined || isNaN(score)) {
    return (
      <span
        data-testid="score-badge-na"
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded font-mono text-xs text-slate-400 bg-slate-100 border border-slate-200',
          className
        )}
      >
        N/A
      </span>
    );
  }

  const roundedScore = Math.round(score);

  // Determine color scheme based on score tiers
  let colorStyles = {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
    label: 'Low Match',
  };

  if (roundedScore >= 85) {
    colorStyles = {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      bar: 'bg-emerald-600',
      label: 'Strong Match',
    };
  } else if (roundedScore >= 70) {
    colorStyles = {
      badge: 'bg-teal-50 text-teal-700 border-teal-200',
      bar: 'bg-teal-600',
      label: 'Good Match',
    };
  } else if (roundedScore >= 50) {
    colorStyles = {
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      bar: 'bg-amber-500',
      label: 'Moderate Match',
    };
  }

  const sizeClasses = {
    sm: 'text-xs font-bold px-2.5 py-1',
    md: 'text-xs font-bold px-2.5 py-1',
    lg: 'text-sm font-bold px-3.5 py-1.5',
  };

  return (
    <div className={cn('inline-flex flex-col gap-1', className)}>
      <span
        data-testid="score-badge"
        data-score={roundedScore}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md font-mono border shadow-subtle tracking-tight',
          sizeClasses[size],
          colorStyles.badge
        )}
      >
        {showIcon && <Sparkles className="w-4 h-4" />}
        <span>{roundedScore}%</span>
      </span>

      {showBar && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300 rounded-full', colorStyles.bar)}
            style={{ width: `${Math.min(100, Math.max(0, roundedScore))}%` }}
          />
        </div>
      )}
    </div>
  );
}
