import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  ConfirmDialog,
} from "../../components/common";
import { Button, Dialog, Input } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";
import {
  Sliders,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  History,
  Save,
} from "lucide-react";
import { DEFAULT_SCORING_WEIGHTS, maxFor, normalizeScoringWeights, remainingWeight, setScoringWeight, type ScoringDimension } from "../../lib/scoring-weights";
import { notify } from "../../lib/feedback";

const METRICS: { key: ScoringDimension; id: string; label: string; description: string }[] = [
  { key: "SKILLS", id: "skills", label: "Skills", description: "How closely a candidate's skills match the job." },
  { key: "EXPERIENCE", id: "experience", label: "Relevant experience", description: "Similar roles, seniority, and industry experience." },
  { key: "LOCATION", id: "location", label: "Location", description: "How close the candidate is to the work location." },
  { key: "COMPLIANCE", id: "compliance", label: "Requirements", description: "Readiness to provide required documents." },
  { key: "EDUCATION_CERTIFICATIONS", id: "education", label: "Education and certifications", description: "Education, training, and required certifications." },
];

export const ScoringConfigPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [weights, setWeights] = useState(DEFAULT_SCORING_WEIGHTS);
  const { SKILLS: skillsWeight, EXPERIENCE: experienceWeight, LOCATION: locationWeight,
    COMPLIANCE: complianceWeight, EDUCATION_CERTIFICATIONS: educationWeight } = weights;
  // Raw text while a number box is being edited, so clearing it does not snap to 0 mid-typing.
  const [drafts, setDrafts] = useState<Partial<Record<ScoringDimension, string>>>({});
  const updateWeight = (dimension: ScoringDimension, value: number) => {
    setWeights((current) => setScoringWeight(current, dimension, value));
  };

  const [matchThreshold, setMatchThreshold] = useState<number>(60);
  const [defaultK, setDefaultK] = useState<number>(10);
  const [maximumK, setMaximumK] = useState<number>(50);
  const [minSimilarity, setMinSimilarity] = useState<number>(0.5);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const configQuery = useQuery({
    queryKey: ["admin", "scoring", "config"],
    queryFn: adminApi.getScoringConfig,
  });

  const historyQuery = useQuery({
    queryKey: ["admin", "scoring", "history"],
    queryFn: () => adminApi.getScoringConfigHistory(undefined, 10),
    enabled: historyModalOpen,
  });

  const config = configQuery.data;

  // Synchronize local state when server data is loaded
  useEffect(() => {
    if (config) {
      const w = (config.weights as Record<string, number>) || {};
      setWeights(normalizeScoringWeights(w));
      setDrafts({});

      if (config.matchThreshold !== undefined) setMatchThreshold(config.matchThreshold);

      if (config.knnSettings) {
        if (config.knnSettings.defaultK !== undefined) setDefaultK(config.knnSettings.defaultK);
        if (config.knnSettings.maximumK !== undefined) setMaximumK(config.knnSettings.maximumK);
        if (config.knnSettings.minimumSimilarity !== undefined) setMinSimilarity(config.knnSettings.minimumSimilarity);
      }
    }
  }, [config]);

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: adminApi.updateScoringConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scoring"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      const msg = "Candidate matching settings saved.";
      setFeedback({ type: "success", message: msg });
      notify.success("Matching settings saved", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "We couldn't save the matching settings. Please try again." });
      notify.error("Couldn't save matching settings", err);
    },
  });

  const restoreDefaultsMutation = useMutation({
    mutationFn: adminApi.restoreDefaultScoringConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scoring"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setConfirmRestoreOpen(false);
      const msg = "Default matching settings restored.";
      setFeedback({ type: "success", message: msg });
      notify.success("Default settings restored", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "We couldn't restore the default settings. Please try again." });
      notify.error("Couldn't restore default settings", err);
    },
  });

  const weightSum =
    skillsWeight + experienceWeight + locationWeight + complianceWeight + educationWeight;
  const isWeightValid = weightSum === 100;
  const totalWeight = weightSum;
  const leftToAllocate = remainingWeight(weights);
  const allocationText = leftToAllocate === 0
    ? "100% allocated"
    : leftToAllocate > 0
      ? `${leftToAllocate}% left to allocate`
      : `Over by ${-leftToAllocate}%. Lower a metric to save.`;
  const isKnnValid = Number.isInteger(defaultK) && Number.isInteger(maximumK) &&
    defaultK >= 1 && defaultK <= 100 && maximumK >= 1 && maximumK <= 100 && defaultK <= maximumK &&
    Number.isFinite(minSimilarity) && minSimilarity >= 0 && minSimilarity <= 1 &&
    Number(minSimilarity.toFixed(4)) === minSimilarity;
  const configuredWeights = (config?.weights as Record<string, number>) || {};
  const hasUnsavedChanges = Boolean(
    config && (
      skillsWeight !== (configuredWeights.SKILLS ?? 30) ||
      experienceWeight !== (configuredWeights.EXPERIENCE ?? 25) ||
      locationWeight !== (configuredWeights.LOCATION ?? 15) ||
      complianceWeight !== (configuredWeights.COMPLIANCE ?? 15) ||
      educationWeight !== (configuredWeights.EDUCATION_CERTIFICATIONS ?? 15) ||
      matchThreshold !== (config.matchThreshold ?? 60) ||
      defaultK !== (config.knnSettings?.defaultK ?? 10) ||
      maximumK !== (config.knnSettings?.maximumK ?? 50) ||
      minSimilarity !== (config.knnSettings?.minimumSimilarity ?? 0.5)
    )
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightValid) {
      setFeedback({
        type: "error",
        message: `Match factors must total 100%. They currently total ${totalWeight}%.`,
      });
      return;
    }
    if (!Number.isInteger(matchThreshold) || !Number.isFinite(matchThreshold) || matchThreshold < 0 || matchThreshold > 100) {
      setFeedback({
        type: "error",
        message: "The recommended match score must be a whole number from 0 to 100.",
      });
      return;
    }
    if (!isKnnValid) {
      setFeedback({ type: "error", message: "KNN settings require whole numbers from 1 to 100, default K no greater than maximum K, and similarity from 0 to 1 with up to four decimals." });
      return;
    }
    if (!config) return;

    setFeedback(null);
    updateConfigMutation.mutate({
      expectedRevision: config.revision,
      weights: {
        SKILLS: skillsWeight,
        EXPERIENCE: experienceWeight,
        LOCATION: locationWeight,
        COMPLIANCE: complianceWeight,
        EDUCATION_CERTIFICATIONS: educationWeight,
      },
      knnSettings: {
        defaultK,
        maximumK,
        minimumSimilarity: minSimilarity,
      },
      matchThreshold,
    });
  };

  if (configQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Matching settings" description="Loading matching settings..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (configQuery.isError || !config) {
    return (
      <div className="space-y-6">
        <PageHeader title="Matching settings" description="Matching settings could not be loaded." />
        <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />
      </div>
    );
  }

  const historyItems = historyQuery.data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Matching settings"
        description="Choose how candidate match scores are calculated."
        breadcrumbs={[
          { label: "Administration", href: "/admin" },
          { label: "Matching settings" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<History className="w-3.5 h-3.5" />}
              onClick={() => setHistoryModalOpen(true)}
            >
              Settings history
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-700" />}
              loading={restoreDefaultsMutation.isPending}
              onClick={() => setConfirmRestoreOpen(true)}
            >
              Restore default settings
            </Button>
          </div>
        }
      />

      {feedback && (
        <div
           role={feedback.type === "error" ? "alert" : "status"}
           aria-live="polite"
           className={`p-3 border text-sm flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-navy-soft border-teal-700 text-navy"
              : "bg-rose-50 border-rose-700 text-rose-950"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-navy" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-700" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
             aria-label="Dismiss message"
             className="min-h-11 min-w-11 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Revision Meta Snapshot */}
      <div className="admin-panel p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm font-sans">
        <div>
          <span className="text-slate-500 font-semibold">Current settings: </span>
          <span className="font-bold text-slate-950">
            Last updated {formatDate(config.activatedAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            role="status"
            className={`font-bold px-2 py-0.5 border ${
              isWeightValid
                ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                : "bg-rose-50 text-rose-900 border-rose-300"
            }`}
          >
            {allocationText}
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5 admin-matching-form">
        {/* 5 Dimension Sliders */}
        <div className="admin-panel">
          <div className="p-3 border-b border-slate-300 flex flex-wrap items-center gap-2 bg-slate-100">
            <Sliders className="w-4 h-4 text-navy" />
              <h3 className="text-sm font-semibold text-slate-900">
              Scoring priorities
            </h3>
          </div>

          <div className="p-4 space-y-4">
            <p id="scoring-weight-help" className="text-sm text-slate-600">Set each priority. The total must equal 100%.</p>
            {METRICS.map((metric, index) => (
              <div key={metric.key} className={`space-y-1.5 ${index > 0 ? "pt-3 border-t border-slate-200" : ""}`}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <label htmlFor={`${metric.id}-weight-number`} className="font-semibold text-slate-950">{metric.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      step={1}
                      id={`${metric.id}-weight-number`}
                      aria-describedby="scoring-weight-help"
                      value={drafts[metric.key] ?? String(weights[metric.key])}
                      onKeyDown={(e) => { if (["-", ".", "e", "E", "+", ","].includes(e.key)) e.preventDefault(); }}
                      onChange={(e) => {
                        if (e.target.value === "") {
                          setDrafts((current) => ({ ...current, [metric.key]: "" }));
                          return;
                        }
                        setDrafts((current) => { const { [metric.key]: _drop, ...rest } = current; return rest; });
                        updateWeight(metric.key, Number(e.target.value));
                      }}
                      onBlur={() => {
                        if (drafts[metric.key] === "") updateWeight(metric.key, 0);
                        setDrafts((current) => { const { [metric.key]: _drop, ...rest } = current; return rest; });
                      }}
                      className="w-16 min-h-11 px-2 py-1 text-right font-sans font-bold text-navy tabular-nums border border-slate-300 rounded-md"
                    />
                    <span className="font-sans text-slate-500">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  id={`${metric.id}-weight`}
                  aria-describedby="scoring-weight-help"
                  aria-label={`${metric.label} weight`}
                  value={weights[metric.key]}
                  onChange={(e) => { setDrafts({}); updateWeight(metric.key, Number(e.target.value)); }}
                  className="w-full h-11 accent-navy cursor-pointer"
                />
                <p className="text-xs text-slate-500 font-sans">
                  {metric.description} Up to {maxFor(weights, metric.key)}%.
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Candidate AI Match Threshold */}
        <div className="admin-panel">
          <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-navy" />
              <h3 className="text-sm font-semibold text-slate-900">
                 Recommended match score
              </h3>
            </div>
            <span className="font-sans font-bold text-sm text-navy bg-navy-soft px-2 py-0.5 border border-navy-line">
               Recommend at: {matchThreshold} / 100
            </span>
          </div>

          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-sm">
                 <span className="font-semibold text-slate-950 text-sm">
                   Score for automatic recommendation
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={matchThreshold}
                    required
                    onChange={(e) => { if (e.target.value !== "") setMatchThreshold(Number(e.target.value)); }}
                    aria-label="Recommended match score"
                    className="w-16 px-2 py-1 text-right"
                  />
                  </div>
                  <span className="font-sans text-slate-500">/ 100</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                id="match-threshold"
                aria-label="Recommended match score"
                value={matchThreshold}
                onChange={(e) => setMatchThreshold(Number(e.target.value))}
                 className="w-full h-11 accent-navy cursor-pointer"
              />
              <p className="text-xs text-slate-500 font-sans">
                Candidates scoring {matchThreshold} or higher are recommended automatically. Lower scores stay available for recruiter review. When a job opens, Talent Pool members at or above this score are sent to the recruiter as a notification.
              </p>
            </div>
          </div>
        </div>

        {/* Talent Discovery & Match Parameters */}
        <div className="admin-panel">
          <div className="p-3 border-b border-slate-300 flex flex-wrap items-center gap-2 bg-slate-100">
            <Sliders className="w-4 h-4 text-navy" />
              <h3 className="text-sm font-semibold text-slate-900">
              Who to include in matching
            </h3>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-sm text-slate-700">
              Only active Talent Pool members are matched. Hired and currently deployed people are always left out.
            </p>

            <details className="group border border-slate-200 rounded-md p-3">
              <summary className="text-sm font-semibold text-slate-700 cursor-pointer flex items-center justify-between">
                 Advanced matching options
              </summary>
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                   label="Results shown by default"
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={defaultK}
                  required
                  onChange={(e) => { if (e.target.value !== "") setDefaultK(Number(e.target.value)); }}
                />
                <Input
                   label="Maximum results"
                  type="number"
                  min={10}
                  max={100}
                  step={1}
                  value={maximumK}
                  error={defaultK > maximumK ? "Maximum results must be at least the default count." : undefined}
                  required
                  onChange={(e) => { if (e.target.value !== "") setMaximumK(Number(e.target.value)); }}
                />
                <Input
                   label="Lowest accepted similarity (0–1)"
                  type="number"
                  step="0.0001"
                  min={0}
                  max={1}
                  value={minSimilarity}
                  required
                  onChange={(e) => { if (e.target.value !== "") setMinSimilarity(Number(e.target.value)); }}
                />
              </div>
            </details>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between p-3.5 admin-panel">
          <div className="text-sm font-sans">
            {isWeightValid && isKnnValid && Number.isInteger(matchThreshold) && matchThreshold >= 0 && matchThreshold <= 100 ? (
              <span className="text-emerald-800 font-bold flex items-center gap-1.5" role="status">
                 <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Ready to save
              </span>
            ) : (
              <span className="text-rose-800 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-700" /> {isWeightValid ? "Review the threshold and advanced matching options." : `${allocationText}`}
              </span>
            )}
          </div>

          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={!isWeightValid || !isKnnValid || !Number.isInteger(matchThreshold) || matchThreshold < 0 || matchThreshold > 100}
            loading={updateConfigMutation.isPending}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save matching settings
          </Button>
        </div>
      </form>

      {/* Revision History Modal */}
      <Dialog
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
         title="Settings history"
         description="Review earlier matching settings and when they were saved."
      >
        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          {historyQuery.isLoading ? (
            <LoadingState variant="table" rows={3} />
          ) : historyQuery.isError ? (
            <ErrorState error={historyQuery.error} onRetry={() => historyQuery.refetch()} />
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No earlier settings have been saved.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyItems.map((h) => (
                <div key={h.id} className="py-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 font-sans">
                       Saved settings {h.revision} ({h.status})
                    </span>
                    <span className="text-xs text-slate-400 font-sans">
                      {formatDateTime(h.activatedAt)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-sans">
                     Saved by: {h.activatedBy?.email || "Administrator"}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setHistoryModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Confirm Restore Defaults Dialog */}
      <ConfirmDialog
        open={confirmRestoreOpen}
        onClose={() => setConfirmRestoreOpen(false)}
        onConfirm={() => {
          if (config) {
            restoreDefaultsMutation.mutate(config.revision);
          }
        }}
         title="Restore default matching settings?"
         description="This will replace the current weights and thresholds with the standard settings. Your current settings will remain available in Settings history."
         confirmLabel="Restore default settings"
        variant="warning"
        loading={restoreDefaultsMutation.isPending}
      />
    </div>
  );
};
