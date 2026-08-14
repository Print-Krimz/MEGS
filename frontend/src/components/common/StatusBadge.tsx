import { cn } from '../../lib/utils';
import type {
  ApplicationStatus,
  JobStatus,
  DeploymentStatus,
  EmploymentStatus,
  AssetVerificationState,
} from '../../lib/types/enums';

type AnyStatus =
  | ApplicationStatus
  | JobStatus
  | DeploymentStatus
  | EmploymentStatus
  | AssetVerificationState
  | string;

interface StatusConfig {
  label: string;
  className: string;
  dotColor?: string;
}

const statusConfigMap: Record<string, StatusConfig> = {
  // Application Statuses
  SUBMITTED: {
    label: 'Submitted',
    className: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    dotColor: 'bg-indigo-600',
  },
  PARSING: {
    label: 'Parsing Resume',
    className: 'bg-purple-50 text-purple-800 border-purple-300',
    dotColor: 'bg-purple-600',
  },
  REVIEW: {
    label: 'Review',
    className: 'bg-amber-50 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-600',
  },
  NEEDS_ATTENTION: {
    label: 'Needs Attention',
    className: 'bg-red-50 text-red-800 border-red-300',
    dotColor: 'bg-red-600',
  },
  MATCHED: {
    label: 'Matched',
    className: 'bg-blue-50 text-blue-800 border-blue-300',
    dotColor: 'bg-blue-600',
  },
  TALENT_POOL: {
    label: 'Talent Pool',
    className: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    dotColor: 'bg-cyan-600',
  },
  INITIAL_SCREENING: {
    label: 'Initial Screening',
    className: 'bg-sky-50 text-sky-800 border-sky-300',
    dotColor: 'bg-sky-600',
  },
  CLIENT_ENDORSEMENT: {
    label: 'Client Endorsement',
    className: 'bg-purple-50 text-purple-800 border-purple-300',
    dotColor: 'bg-purple-600',
  },
  FINAL_INTERVIEW: {
    label: 'Final Interview',
    className: 'bg-pink-50 text-pink-800 border-pink-300',
    dotColor: 'bg-pink-600',
  },
  HIRED: {
    label: 'Hired',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-600',
  },
  ONBOARDING: {
    label: 'Onboarding',
    className: 'bg-teal-50 text-teal-800 border-teal-300',
    dotColor: 'bg-teal-600',
  },
  COMPLIANCE: {
    label: 'Compliance',
    className: 'bg-orange-50 text-orange-800 border-orange-300',
    dotColor: 'bg-orange-600',
  },
  DEPLOYED: {
    label: 'Deployed',
    className: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dotColor: 'bg-emerald-700',
  },
  BACKOUT: {
    label: 'Backout',
    className: 'bg-rose-50 text-rose-800 border-rose-300',
    dotColor: 'bg-rose-600',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    dotColor: 'bg-slate-500',
  },

  // Job Statuses
  DRAFT: {
    label: 'Draft',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    dotColor: 'bg-slate-500',
  },
  OPEN: {
    label: 'Open',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-600',
  },
  CLOSED: {
    label: 'Closed',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    dotColor: 'bg-slate-500',
  },

  // Deployment Statuses
  PENDING_ORIENTATION: {
    label: 'Pending Orientation',
    className: 'bg-amber-50 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-600',
  },
  READY: {
    label: 'Ready for Dispatch',
    className: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    dotColor: 'bg-cyan-600',
  },
  DISPATCHED: {
    label: 'Dispatched',
    className: 'bg-blue-50 text-blue-800 border-blue-300',
    dotColor: 'bg-blue-600',
  },
  ACTIVE: {
    label: 'Active',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-600',
  },
  ENDED: {
    label: 'Ended',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    dotColor: 'bg-slate-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-red-50 text-red-800 border-red-300',
    dotColor: 'bg-red-600',
  },

  // Employment Statuses
  INACTIVE: {
    label: 'Inactive',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    dotColor: 'bg-slate-500',
  },
  SEPARATED: {
    label: 'Separated',
    className: 'bg-rose-50 text-rose-800 border-rose-300',
    dotColor: 'bg-rose-600',
  },
  AVAILABLE_FOR_REDEPLOYMENT: {
    label: 'Redeployment Pool',
    className: 'bg-teal-50 text-teal-800 border-teal-300',
    dotColor: 'bg-teal-600',
  },

  // Asset / Document Verification States
  UNVERIFIED: {
    label: 'Unverified',
    className: 'bg-amber-50 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-600',
  },
  VERIFIED: {
    label: 'Verified',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-600',
  },
  // Admin User & Account Statuses
  INVITED: {
    label: 'Invited',
    className: 'bg-amber-50 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-600',
  },
  PENDING_SETUP: {
    label: 'Pending Setup',
    className: 'bg-amber-50 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-600',
  },
  DEACTIVATED: {
    label: 'Deactivated',
    className: 'bg-rose-50 text-rose-800 border-rose-300',
    dotColor: 'bg-rose-600',
  },

  // Scoring & Configuration Statuses
  GLOBAL: {
    label: 'Global Scope',
    className: 'bg-blue-50 text-blue-800 border-blue-300',
    dotColor: 'bg-blue-600',
  },
  SUPERSEDED: {
    label: 'Superseded',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    dotColor: 'bg-slate-500',
  },
  PROCESSING: {
    label: 'Processing',
    className: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    dotColor: 'bg-indigo-600 animate-pulse',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-600',
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-red-50 text-red-800 border-red-300',
    dotColor: 'bg-red-600',
  },
  CALCULATED: {
    label: 'Calculated',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-600',
  },
  STALE: {
    label: 'Stale',
    className: 'bg-amber-50 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-600',
  },
};

interface StatusBadgeProps {
  status: AnyStatus;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
  customLabel?: string;
}

export function StatusBadge({
  status,
  size = 'md',
  showDot = true,
  className,
  customLabel,
}: StatusBadgeProps) {
  const normalizedKey = status ? String(status).toUpperCase() : '';
  const config = statusConfigMap[normalizedKey] || {
    label: status ? String(status).replace(/_/g, ' ') : 'Pending',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    dotColor: 'bg-slate-500',
  };

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5 gap-1.5 font-medium',
    md: 'text-xs px-3 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  };

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span
      data-testid="status-badge"
      className={cn(
        'inline-flex items-center rounded-full border shadow-subtle transition-colors duration-150 select-none tracking-tight whitespace-nowrap',
        sizeClasses[size],
        config.className,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'rounded-full flex-shrink-0',
            dotSizes[size],
            config.dotColor || 'bg-current'
          )}
          aria-hidden="true"
        />
      )}
      <span>{customLabel || config.label}</span>
    </span>
  );
}
