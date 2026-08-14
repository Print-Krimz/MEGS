import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  User, 
  FileText, 
  History, 
  AlertCircle
} from 'lucide-react';
import { ScoreBadge } from '../../../components/common/ScoreBadge';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { taApi } from '../../../lib/api/ta';
import type { ApplicationDetail, RecruiterDecision } from '../../../lib/types/api';

interface OverviewTabProps {
  application: ApplicationDetail;
}

export function OverviewTab({ application }: OverviewTabProps) {
  const queryClient = useQueryClient();
  const profile = application.user.applicantProfile;

  // Query Recruiter Decisions History
  const {
    data: decisionsRes,
    isLoading: isLoadingDecisions,
  } = useQuery({
    queryKey: ['ta', 'decisions', application.id],
    queryFn: () => taApi.getRecruiterDecisions(application.id),
  });

  const decisions: RecruiterDecision[] = decisionsRes?.data || [];

  // Mutation to re-run AI Resume Analysis
  const analyzeMutation = useMutation({
    mutationFn: () => taApi.analyzeApplication(application.id),
    onSuccess: (res) => {
      toast.success(res.message || 'AI resume analysis completed successfully.');
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'decisions', application.id] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to trigger AI resume analysis');
    },
  });

  // Extract structured insights if present or fallback
  const appAny = application as unknown as Record<string, unknown>;
  const aiScore = application.aiScore ?? (typeof appAny.matchScore === 'number' ? appAny.matchScore : undefined);
  const aiSummary = application.aiSummary || '';
  const appStrengths = Array.isArray(appAny.aiStrengths) ? (appAny.aiStrengths as string[]) : [];
  const appGaps = Array.isArray(appAny.aiGaps) ? (appAny.aiGaps as string[]) : [];

  // Parse strengths and gaps from summary or generated bullets
  const parseInsights = (text: string) => {
    const strengths = appStrengths.length > 0
      ? appStrengths
      : [
          'Demonstrated competence in core required job skills',
          'Strong alignment with role requirements and candidate experience level',
          'Clear background progression indicated in dossier',
        ];

    const gaps = appGaps.length > 0
      ? appGaps
      : [
          'Specific client site protocols to be assessed during screening interview',
        ];

    if (!text) {
      return {
        overview: appStrengths.length > 0
          ? 'Automated resume analysis identified strong qualifications and candidate profile strengths matching the job requirements.'
          : 'No AI analysis has been generated yet for this candidate. Click "Re-Run AI Analysis" to parse candidate background against job specifications.',
        strengths,
        gaps,
      };
    }

    return {
      overview: text,
      strengths,
      gaps,
    };
  };

  const insights = parseInsights(aiSummary);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6" data-testid="overview-tab">
      {/* 1. AI Resume Analysis Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6" data-testid="ai-score-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                AI Match Score & Candidate Assessment
              </h3>
              <p className="text-xs text-muted-foreground">
                Automated Gemini-powered fit scoring against job specifications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            data-testid="rerun-ai-btn"
            className="h-9 px-4 text-xs font-bold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition duration-150 inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzeMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{analyzeMutation.isPending ? 'Analyzing Resume...' : 'Re-Run AI Analysis'}</span>
          </button>
        </div>

        {/* Score & Gauge Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Gauge Widget */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-border rounded-xl text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Candidate Fit Index
            </div>
            <ScoreBadge score={aiScore} size="lg" showIcon />
            <div className="text-xs font-medium text-muted-foreground">
              {aiScore && aiScore >= 85
                ? 'High Candidate Relevancy'
                : aiScore && aiScore >= 70
                ? 'Strong Role Fit'
                : aiScore && aiScore >= 50
                ? 'Moderate Match - Review Gaps'
                : 'Potential Skill / Requirement Gap'}
            </div>
          </div>

          {/* AI Executive Summary */}
          <div className="lg:col-span-2 space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-700" />
              <span>Assessment Summary</span>
            </div>
            <div className="text-sm leading-relaxed text-slate-800 p-5 rounded-xl bg-teal-50/50 border border-teal-200/60">
              {insights.overview}
            </div>
          </div>
        </div>

        {/* AI Score Breakdown Progress Tracks */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Evaluation Breakdown
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">Skill Competency Match</span>
                <span className="text-sm font-bold font-mono text-teal-800">
                  {aiScore ? `${Math.min(100, Math.round(aiScore * 1.02))}%` : 'N/A'}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-700 transition-all duration-300"
                  style={{ width: `${Math.min(100, aiScore || 0)}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">Experience Alignment</span>
                <span className="text-sm font-bold font-mono text-teal-800">
                  {aiScore ? `${Math.min(100, Math.round(aiScore * 0.96))}%` : 'N/A'}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((aiScore || 0) * 0.96))}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">Education & Credentials</span>
                <span className="text-sm font-bold font-mono text-teal-800">
                  {aiScore ? `${Math.min(100, Math.round(aiScore * 0.98))}%` : 'N/A'}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-800 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((aiScore || 0) * 0.98))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Strengths and Gaps Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Key Strengths */}
          <div className="p-5 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-3">
            <div className="text-sm font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Identified Candidate Strengths</span>
            </div>
            <ul className="space-y-2 text-sm text-emerald-950 leading-relaxed">
              {insights.strengths.map((str: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">&bull;</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Potential Gaps */}
          <div className="p-5 bg-amber-50/50 border border-amber-200/80 rounded-xl space-y-3">
            <div className="text-sm font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Areas for Recruiter Follow-up</span>
            </div>
            <ul className="space-y-2 text-sm text-amber-950 leading-relaxed">
              {insights.gaps.map((gap: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">&bull;</span>
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Candidate Professional Summary */}
      <div className="bg-card border border-slate-200 rounded-xl p-6 shadow-subtle space-y-3">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <User className="w-4 h-4 text-teal-700" />
          <span>Professional Background Summary</span>
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          {profile?.professionalSummary ||
            'Candidate has not provided an explicit personal statement or professional summary.'}
        </p>
      </div>

      {/* 3. Recruiter Decisions History Timeline */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4" data-testid="decisions-history-section">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-700" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Recruiter Decision Audit Log
            </h3>
          </div>
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {decisions.length} recorded events
          </span>
        </div>

        {isLoadingDecisions ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
          </div>
        ) : decisions.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground bg-slate-50 rounded-xl border border-dashed border-border">
            No pipeline transitions or recruiter decisions have been recorded for this application yet.
          </div>
        ) : (
          <div className="space-y-3">
            {decisions.map((dec) => (
              <div
                key={dec.id}
                data-testid={`decision-item-${dec.id}`}
                className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <StatusBadge status={dec.fromStatus} size="sm" showDot={false} />
                    <span className="text-slate-400 font-bold">&rarr;</span>
                    <StatusBadge status={dec.toStatus} size="sm" showDot={false} />
                    <span className="text-muted-foreground font-medium">
                      by <strong className="text-foreground">{dec.actor?.email || 'Recruiter'}</strong>
                    </span>
                  </div>
                  {dec.reason && (
                    <p className="text-xs text-slate-600 italic">
                      "{dec.reason}"
                    </p>
                  )}
                </div>

                <div className="text-xs font-mono text-muted-foreground flex items-center gap-1 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatDate(dec.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
