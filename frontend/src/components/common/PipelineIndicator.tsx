import { Check, Archive, Users, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ApplicationStatus, CANONICAL_PIPELINE_STAGES } from '../../lib/types/enums';

interface PipelineIndicatorProps {
  currentStatus: ApplicationStatus;
  variant?: 'horizontal' | 'condensed' | 'vertical';
  className?: string;
}

const STAGE_ORDER: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.REVIEW,
  ApplicationStatus.INITIAL_SCREENING,
  ApplicationStatus.CLIENT_ENDORSEMENT,
  ApplicationStatus.FINAL_INTERVIEW,
  ApplicationStatus.HIRED,
  ApplicationStatus.COMPLIANCE,
  ApplicationStatus.DEPLOYED,
];

// Helper to map auxiliary statuses to the nearest canonical stage for progress evaluation
function getActiveStageIndex(status: ApplicationStatus): number {
  switch (status) {
    case ApplicationStatus.SUBMITTED:
      return 0;
    case ApplicationStatus.PARSING:
    case ApplicationStatus.NEEDS_ATTENTION:
    case ApplicationStatus.REVIEW:
    case ApplicationStatus.MATCHED:
      return 1;
    case ApplicationStatus.INITIAL_SCREENING:
      return 2;
    case ApplicationStatus.CLIENT_ENDORSEMENT:
      return 3;
    case ApplicationStatus.FINAL_INTERVIEW:
      return 4;
    case ApplicationStatus.HIRED:
    case ApplicationStatus.ONBOARDING:
      return 5;
    case ApplicationStatus.COMPLIANCE:
      return 6;
    case ApplicationStatus.DEPLOYED:
      return 7;
    default:
      return -1; // Off-ramp states (ARCHIVED, TALENT_POOL, BACKOUT)
  }
}

export function PipelineIndicator({
  currentStatus,
  variant = 'horizontal',
  className,
}: PipelineIndicatorProps) {
  const activeIndex = getActiveStageIndex(currentStatus);
  const isOffRamp = ['TALENT_POOL', 'ARCHIVED', 'BACKOUT'].includes(currentStatus);

  if (variant === 'condensed') {
    return (
      <div className={cn('flex items-center gap-1.5', className)} data-testid="pipeline-indicator-condensed">
        {STAGE_ORDER.map((stage, index) => {
          const isPassed = activeIndex >= 0 && index < activeIndex;
          const isCurrent = activeIndex === index;

          return (
            <div
              key={stage}
              title={stage.replace('_', ' ')}
              className={cn(
                'h-1.5 rounded-full transition-all duration-200',
                isPassed && 'w-3 bg-teal-600',
                isCurrent && 'w-5 bg-teal-700 ring-2 ring-teal-200',
                !isPassed && !isCurrent && 'w-3 bg-slate-200'
              )}
            />
          );
        })}
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div className={cn('space-y-4', className)} data-testid="pipeline-indicator-vertical">
        {isOffRamp && (
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-border text-xs font-medium text-slate-700">
            {currentStatus === 'TALENT_POOL' && (
              <>
                <Users className="w-4 h-4 text-cyan-600 shrink-0" />
                <span>Talent Pool</span>
              </>
            )}
            {currentStatus === 'ARCHIVED' && (
              <>
                <Archive className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Archived</span>
              </>
            )}
            {currentStatus === 'BACKOUT' && (
              <>
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Backout</span>
              </>
            )}
          </div>
        )}
        <div className="relative pl-1">
          {CANONICAL_PIPELINE_STAGES.map((stage, index) => {
            const isPassed = activeIndex >= 0 && index < activeIndex;
            const isCurrent = activeIndex === index;
            const isPending = activeIndex >= 0 ? index > activeIndex : true;

            return (
              <div key={stage.status} className="flex items-start gap-3 relative pb-4 last:pb-0">
                {index < CANONICAL_PIPELINE_STAGES.length - 1 && (
                  <div
                    className={cn(
                      'absolute left-3.5 top-7 bottom-0 w-0.5 -translate-x-1/2',
                      isPassed ? 'bg-teal-600' : 'bg-slate-200'
                    )}
                    aria-hidden="true"
                  />
                )}
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 border-2 transition-all duration-150 relative z-10',
                    isPassed && 'bg-teal-700 border-teal-700 text-white',
                    isCurrent && 'bg-teal-700 border-teal-700 text-white ring-4 ring-teal-100',
                    isPending && 'bg-white border-slate-300 text-slate-400'
                  )}
                >
                  {isPassed ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="pt-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isCurrent && 'text-teal-900 font-bold',
                        isPassed && 'text-slate-900',
                        isPending && 'text-slate-400'
                      )}
                    >
                      {stage.label}
                    </span>
                    {isCurrent && (
                      <span className="text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-800 uppercase rounded font-mono">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{stage.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="pipeline-indicator"
      className={cn('w-full bg-card border border-border rounded-xl p-5 shadow-subtle', className)}
    >
      {isOffRamp && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-border text-xs font-medium text-slate-700">
          {currentStatus === 'TALENT_POOL' && (
            <>
              <Users className="w-4 h-4 text-cyan-600" />
              <span>Candidate is currently routed to the <strong>Talent Pool</strong> for future job matching.</span>
            </>
          )}
          {currentStatus === 'ARCHIVED' && (
            <>
              <Archive className="w-4 h-4 text-slate-500" />
              <span>Application is <strong>Archived</strong>.</span>
            </>
          )}
          {currentStatus === 'BACKOUT' && (
            <>
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Candidate recorded a <strong>Backout</strong> after hiring.</span>
            </>
          )}
        </div>
      )}

      {/* Horizontal Layout */}
      <div className="relative flex items-center justify-between">
        {/* Progress Background Line */}
        <div
          className="absolute left-6 right-6 top-3.5 -translate-y-1/2 h-0.5 bg-slate-200"
          aria-hidden="true"
        />

        {/* Active Progress Foreground Line */}
        {activeIndex > 0 && (
          <div
            className="absolute left-6 top-3.5 -translate-y-1/2 h-0.5 bg-teal-700 transition-all duration-300"
            style={{
              width: `${(Math.min(activeIndex, STAGE_ORDER.length - 1) / (STAGE_ORDER.length - 1)) * 100}%`,
              maxWidth: 'calc(100% - 3rem)',
            }}
            aria-hidden="true"
          />
        )}

        {CANONICAL_PIPELINE_STAGES.map((stage, index) => {
          const isPassed = activeIndex >= 0 && index < activeIndex;
          const isCurrent = activeIndex === index;
          const isPending = activeIndex >= 0 ? index > activeIndex : true;

          return (
            <div
              key={stage.status}
              data-testid={`pipeline-step-${stage.status.toLowerCase()}`}
              className={cn(
                'relative z-10 flex flex-col items-center group cursor-default text-center',
                isCurrent && 'scale-105'
              )}
            >
              {/* Step Circle Node */}
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold border-2 transition-all duration-150 shadow-subtle',
                  isPassed && 'bg-teal-700 border-teal-700 text-white',
                  isCurrent && 'bg-teal-700 border-teal-700 text-white ring-4 ring-teal-100',
                  isPending && 'bg-white border-slate-300 text-slate-400'
                )}
              >
                {isPassed ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Step Label */}
              <div className="mt-2 max-w-[84px]">
                <p
                  className={cn(
                    'text-xs font-semibold leading-tight tracking-tight transition-colors',
                    isCurrent && 'text-teal-900 font-bold',
                    isPassed && 'text-slate-700',
                    isPending && 'text-slate-400'
                  )}
                >
                  {stage.label}
                </p>
                {isCurrent && (
                  <span className="inline-block mt-0.5 text-xs text-teal-700 font-bold font-mono">
                    Current
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
