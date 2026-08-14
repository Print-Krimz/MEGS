import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  FileSearch, 
  Clock, 
  Send, 
  CalendarCheck, 
  UserCheck, 
  ShieldCheck, 
  Briefcase,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import type { PipelineStats } from '../../../lib/types/api';
import { ApplicationStatus } from '../../../lib/types/enums';

interface PipelineSummaryBarProps {
  stats?: PipelineStats | null;
  isLoading?: boolean;
}

const PIPELINE_STAGES: {
  status: ApplicationStatus;
  label: string;
  icon: typeof Users;
  color: string;
  barBg: string;
}[] = [
  { status: ApplicationStatus.SUBMITTED, label: 'Submitted', icon: Users, color: 'text-indigo-600', barBg: 'bg-indigo-500' },
  { status: ApplicationStatus.REVIEW, label: 'Review', icon: FileSearch, color: 'text-amber-600', barBg: 'bg-amber-500' },
  { status: ApplicationStatus.NEEDS_ATTENTION, label: 'Needs Attention', icon: AlertTriangle, color: 'text-rose-600', barBg: 'bg-rose-500' },
  { status: ApplicationStatus.INITIAL_SCREENING, label: 'Screening', icon: Clock, color: 'text-sky-600', barBg: 'bg-sky-500' },
  { status: ApplicationStatus.CLIENT_ENDORSEMENT, label: 'Endorsement', icon: Send, color: 'text-purple-600', barBg: 'bg-purple-500' },
  { status: ApplicationStatus.FINAL_INTERVIEW, label: 'Final Interview', icon: CalendarCheck, color: 'text-pink-600', barBg: 'bg-pink-500' },
  { status: ApplicationStatus.HIRED, label: 'Hired', icon: UserCheck, color: 'text-emerald-600', barBg: 'bg-emerald-500' },
  { status: ApplicationStatus.COMPLIANCE, label: 'Compliance', icon: ShieldCheck, color: 'text-orange-600', barBg: 'bg-orange-500' },
  { status: ApplicationStatus.DEPLOYED, label: 'Deployed', icon: Briefcase, color: 'text-teal-700', barBg: 'bg-teal-600' },
];

export function PipelineSummaryBar({ stats, isLoading = false }: PipelineSummaryBarProps) {
  const navigate = useNavigate();

  const handleStageClick = (status: ApplicationStatus) => {
    navigate(`/ta/applications?status=${status}`);
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-subtle space-y-4" data-testid="pipeline-summary-loading">
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 border border-slate-200 rounded-xl p-3.5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const byStatus = stats?.byStatus || ({} as Record<ApplicationStatus, number>);
  const totalActive = stats?.totalActive ?? 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-subtle space-y-4" data-testid="pipeline-summary-bar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <span>Pipeline Progression</span>
            <span className="text-xs font-mono font-normal text-muted-foreground">
              ({totalActive} active candidates)
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click any stage to filter active candidates in the recruitment pipeline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/ta/applications')}
          className="text-xs font-semibold text-teal-800 hover:text-teal-900 inline-flex items-center gap-1 transition-colors self-start sm:self-auto"
        >
          <span>View All Pipeline</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Overall Progress / Distribution Track */}
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex border border-slate-200/50">
        {PIPELINE_STAGES.map((stage) => {
          const count = byStatus[stage.status] ?? 0;
          const pct = totalActive > 0 ? (count / totalActive) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={stage.status}
              className={`h-full ${stage.barBg} transition-all duration-300`}
              style={{ width: `${pct}%` }}
              title={`${stage.label}: ${count} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3">
        {PIPELINE_STAGES.map((stage) => {
          const count = byStatus[stage.status] ?? 0;
          const Icon = stage.icon;

          return (
            <button
              key={stage.status}
              type="button"
              onClick={() => handleStageClick(stage.status)}
              data-testid={`pipeline-stage-${stage.status.toLowerCase()}`}
              className="p-3.5 rounded-xl border border-border bg-card hover:border-teal-400 hover:shadow-xs transition-all text-left flex flex-col justify-between cursor-pointer group"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-foreground leading-tight truncate">
                  {stage.label}
                </span>
                <Icon className={`w-4 h-4 ${stage.color} opacity-80 group-hover:opacity-100 transition-opacity shrink-0`} />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold font-mono text-foreground mt-1">
                  {count}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  candidates
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
