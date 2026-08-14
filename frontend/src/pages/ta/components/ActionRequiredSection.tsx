import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  Clock, 
  FileWarning, 
  CheckCircle2, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import type { ApplicationListItem } from '../../../lib/types/api';

interface ActionRequiredSectionProps {
  needsAttentionApplications?: ApplicationListItem[];
  pendingSlaInterviewsCount?: number;
  unreviewedDocsCount?: number;
  isLoading?: boolean;
}

export function ActionRequiredSection({
  needsAttentionApplications = [],
  pendingSlaInterviewsCount = 0,
  unreviewedDocsCount = 0,
  isLoading = false,
}: ActionRequiredSectionProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4" data-testid="action-required-loading">
        <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-36 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-36 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-36 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const hasUrgentItems =
    needsAttentionApplications.length > 0 ||
    pendingSlaInterviewsCount > 0 ||
    unreviewedDocsCount > 0;

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4" data-testid="action-required-section">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${hasUrgentItems ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {hasUrgentItems ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              Operational Attention Center
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Critical bottlenecks, SLA thresholds, and unresolved candidate blockers.
            </p>
          </div>
        </div>
      </div>

      {!hasUrgentItems ? (
        <div className="p-6 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-center space-y-1.5">
          <div className="inline-flex p-2 bg-emerald-100 text-emerald-700 rounded-full mb-1">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-emerald-900">All Pipeline Queues Clear</h3>
          <p className="text-xs text-emerald-700 max-w-md mx-auto">
            No applications need immediate intervention, no interview SLAs have breached the 7-day threshold, and compliance items are up to date.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Needs Attention Candidates */}
          <div className="p-4.5 rounded-xl border border-border bg-background hover:bg-slate-50/60 transition-colors flex flex-col justify-between space-y-3">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wide inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Needs Attention
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  {needsAttentionApplications.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Candidates with parse failures, missing required fields, or recruiter review flags.
              </p>
              {needsAttentionApplications.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {needsAttentionApplications.slice(0, 2).map((app) => (
                    <Link
                      key={app.id}
                      to={`/ta/applications/${app.id}`}
                      className="block p-2 rounded-lg bg-card border border-border hover:border-teal-400/50 hover:bg-slate-50 transition-all"
                    >
                      <div className="text-sm font-bold text-foreground truncate">
                        {app.user.applicantProfile?.firstName} {app.user.applicantProfile?.lastName || app.user.email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {app.jobPosting.title}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link
              to="/ta/applications?status=NEEDS_ATTENTION"
              className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 inline-flex items-center gap-1.5 transition-colors self-start mt-2"
            >
              <span>Review Flagged Applications</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 2: SLA Breached Interviews */}
          <div className="p-4.5 rounded-xl border border-border bg-background hover:bg-slate-50/60 transition-colors flex flex-col justify-between space-y-3">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wide inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Interview SLA Warnings
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {pendingSlaInterviewsCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Candidates waiting in interview stages &gt;7 days without recorded outcomes.
              </p>
            </div>
            <Link
              to="/ta/interviews"
              className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 inline-flex items-center gap-1.5 transition-colors self-start mt-2"
            >
              <span>Manage Pending Interviews</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 3: Unreviewed Compliance Documents */}
          <div className="p-4.5 rounded-xl border border-border bg-background hover:bg-slate-50/60 transition-colors flex flex-col justify-between space-y-3">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide inline-flex items-center gap-1.5">
                  <FileWarning className="w-4 h-4 text-indigo-600" />
                  Compliance Verification
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {unreviewedDocsCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mandatory pre-employment submissions awaiting recruiter approval/rejection.
              </p>
            </div>
            <Link
              to="/ta/compliance"
              className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 inline-flex items-center gap-1.5 transition-colors self-start mt-2"
            >
              <span>Open Compliance Review</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
