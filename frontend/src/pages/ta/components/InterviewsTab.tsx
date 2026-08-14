import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  UserX, 
  Plus, 
  Edit3,
  X
} from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { taApi } from '../../../lib/api/ta';
import { InterviewType } from '../../../lib/types/enums';
import type { ApplicationDetail, Interview } from '../../../lib/types/api';

interface InterviewsTabProps {
  application: ApplicationDetail;
  isScheduleModalOpen?: boolean;
  scheduleInitialType?: 'INITIAL_SCREENING' | 'FINAL_INTERVIEW';
  onCloseScheduleModal?: () => void;
}

export function InterviewsTab({
  application,
  isScheduleModalOpen: externalScheduleOpen,
  scheduleInitialType = 'INITIAL_SCREENING',
  onCloseScheduleModal,
}: InterviewsTabProps) {
  const queryClient = useQueryClient();

  // Internal modal states
  const [internalScheduleOpen, setInternalScheduleOpen] = useState(false);
  const [interviewType, setInterviewType] = useState<InterviewType>(
    scheduleInitialType as InterviewType
  );
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');

  // Result dialog state
  const [selectedInterviewForOutcome, setSelectedInterviewForOutcome] = useState<Interview | null>(null);
  const [interviewResult, setInterviewResult] = useState<'PASSED' | 'FAILED' | 'NO_SHOW'>('PASSED');
  const [conductedAt, setConductedAt] = useState('');
  const [resultNotes, setResultNotes] = useState('');

  const isScheduleOpen = Boolean(externalScheduleOpen || internalScheduleOpen);
  const handleCloseSchedule = () => {
    setInternalScheduleOpen(false);
    if (onCloseScheduleModal) onCloseScheduleModal();
  };

  // 1. Query Interviews
  const {
    data: interviewsRes,
    isLoading,
  } = useQuery({
    queryKey: ['ta', 'interviews', application.id],
    queryFn: () => taApi.listInterviews(application.id),
  });

  const interviews: Interview[] = interviewsRes?.data || application.interviews || [];

  // 2. Mutation: Schedule Interview
  const scheduleMutation = useMutation({
    mutationFn: () =>
      taApi.scheduleInterview(application.id, {
        type: interviewType,
        scheduledAt,
        notes: scheduleNotes,
      }),
    onSuccess: () => {
      toast.success('Interview scheduled successfully');
      handleCloseSchedule();
      setScheduledAt('');
      setScheduleNotes('');
      queryClient.invalidateQueries({ queryKey: ['ta', 'interviews', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'pipeline-stats'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to schedule interview');
    },
  });

  // 3. Mutation: Record Interview Result
  const outcomeMutation = useMutation({
    mutationFn: () => {
      if (!selectedInterviewForOutcome) throw new Error('No interview selected');
      return taApi.updateInterviewStatus(
        application.id,
        selectedInterviewForOutcome.id,
        {
          result: interviewResult,
          conductedAt: conductedAt || new Date().toISOString(),
          notes: resultNotes,
        }
      );
    },
    onSuccess: () => {
      toast.success(`Interview result recorded as ${interviewResult}`);
      setSelectedInterviewForOutcome(null);
      setResultNotes('');
      queryClient.invalidateQueries({ queryKey: ['ta', 'interviews', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'pipeline-stats'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to record interview result');
    },
  });

  // Calculate 7-day SLA check for each interview
  const isSlaBreached = (interview: Interview) => {
    if (interview.result && interview.result !== 'PENDING') return false;
    const dateToCheck = interview.scheduledAt || interview.createdAt;
    if (!dateToCheck) return false;
    const diffMs = Date.now() - new Date(dateToCheck).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Unscheduled';
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
    <div className="space-y-6" data-testid="interviews-tab">
      {/* Header and Schedule Trigger */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Recruiter & Panel Interview Tracking
          </h3>
          <p className="text-xs text-muted-foreground">
            Schedule initial screenings and client panel interviews within the 7-day SLA target window.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setInterviewType('INITIAL_SCREENING');
            setInternalScheduleOpen(true);
          }}
          data-testid="open-schedule-interview-modal-btn"
          className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition duration-150 flex items-center gap-1.5 self-start sm:self-auto shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Schedule Interview</span>
        </button>
      </div>

      {/* Interviews List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          </div>
        ) : interviews.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-border space-y-2">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-semibold text-foreground">No Interviews Scheduled</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Schedule an initial HR screening or final panel interview to advance this candidate.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="interviews-list">
            {interviews.map((item) => {
              const breached = isSlaBreached(item);
              const isPending = !item.result || item.result === 'PENDING';

              return (
                <div
                  key={item.id}
                  data-testid={`interview-item-${item.id}`}
                  className="bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 flex items-center justify-center font-bold text-xs shrink-0">
                          {item.type === 'FINAL_INTERVIEW' ? 'HR' : 'TA'}
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-foreground block">
                            {item.type === 'FINAL_INTERVIEW' ? 'Client Panel Interview' : 'Initial HR Screening'}
                          </span>
                          <span className="text-xs text-muted-foreground block font-mono">
                            {item.type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <StatusBadge
                        status={item.result || 'PENDING'}
                        size="sm"
                        customLabel={item.result || 'Pending Outcome'}
                      />

                      {breached && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>SLA Threshold Breached (&gt;7 Days)</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                      <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Scheduled: {formatDate(item.scheduledAt)}</span>
                      </span>

                      {item.conductedAt && (
                        <span className="text-xs font-mono text-foreground">
                          Conducted: {formatDate(item.conductedAt)}
                        </span>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-border p-3 rounded-lg max-w-xl">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {isPending && (
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInterviewForOutcome(item);
                          setInterviewResult('PASSED');
                          setConductedAt(new Date().toISOString().slice(0, 16));
                        }}
                        data-testid={`record-result-btn-${item.id}`}
                        className="h-9 px-4 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Record Outcome</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal 1: Schedule Interview Modal */}
      {isScheduleOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-modal overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-700" />
                <span>Schedule Candidate Interview</span>
              </h3>
              <button
                type="button"
                onClick={handleCloseSchedule}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!scheduledAt) {
                  toast.error('Please select interview schedule date and time');
                  return;
                }
                scheduleMutation.mutate();
              }}
              className="space-y-4 text-xs"
              data-testid="schedule-interview-form"
            >
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Interview Stage / Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                  data-testid="interview-type-select"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="INITIAL_SCREENING">Initial HR Screening</option>
                  <option value="FINAL_INTERVIEW">Final Panel / Client Interview</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Scheduled Date & Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  data-testid="interview-scheduled-at-input"
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Preparation Notes / Location Link (Optional)
                </label>
                <textarea
                  rows={3}
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="e.g. Google Meet link, panel interviewers, special assessment topics..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleCloseSchedule}
                  className="px-3.5 py-2 rounded-lg font-medium text-slate-700 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleMutation.isPending}
                  data-testid="submit-schedule-interview-btn"
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 shadow-xs"
                >
                  {scheduleMutation.isPending ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Record Interview Result Dialog */}
      {selectedInterviewForOutcome && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-modal overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700" />
                <span>Record Interview Outcome</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedInterviewForOutcome(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                outcomeMutation.mutate();
              }}
              className="space-y-4 text-xs"
              data-testid="record-interview-result-form"
            >
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Interview Result <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setInterviewResult('PASSED')}
                    data-testid="result-pass-btn"
                    className={`py-2 px-3 rounded-lg border text-center font-bold transition duration-150 cursor-pointer ${
                      interviewResult === 'PASSED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    PASSED
                  </button>

                  <button
                    type="button"
                    onClick={() => setInterviewResult('FAILED')}
                    data-testid="result-fail-btn"
                    className={`py-2 px-3 rounded-lg border text-center font-bold transition duration-150 cursor-pointer ${
                      interviewResult === 'FAILED'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    FAILED
                  </button>

                  <button
                    type="button"
                    onClick={() => setInterviewResult('NO_SHOW')}
                    data-testid="result-noshow-btn"
                    className={`py-2 px-3 rounded-lg border text-center font-bold transition duration-150 cursor-pointer ${
                      interviewResult === 'NO_SHOW'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    NO SHOW
                  </button>
                </div>

                {interviewResult === 'NO_SHOW' && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2">
                    <UserX className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Warning:</strong> Recording a candidate as NO_SHOW will automatically archive their application in the backend pipeline.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Rating Score Evaluation (1 - 5)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => {
                        const notePrefix = `[Score: ${score}/5] `;
                        setResultNotes((prev) =>
                          prev.startsWith('[Score:')
                            ? prev.replace(/^\[Score:\s*\d\/5\]\s*/, notePrefix)
                            : notePrefix + prev
                        );
                      }}
                      className="w-10 h-10 text-sm font-bold rounded-lg border border-border bg-slate-50 dark:bg-slate-800 text-foreground hover:bg-teal-50 hover:border-teal-500 hover:text-teal-700 dark:hover:bg-teal-950 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Conducted At
                </label>
                <input
                  type="datetime-local"
                  value={conductedAt}
                  onChange={(e) => setConductedAt(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Feedback & Decision Notes
                </label>
                <textarea
                  rows={3}
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  placeholder="Record interviewer impressions, strengths, weaknesses, or rejection rationale..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedInterviewForOutcome(null)}
                  className="px-3.5 py-2 rounded-lg font-medium text-slate-700 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={outcomeMutation.isPending}
                  data-testid="submit-interview-result-btn"
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 shadow-xs"
                >
                  {outcomeMutation.isPending ? 'Saving...' : 'Save Result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
