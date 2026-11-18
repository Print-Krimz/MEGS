import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
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
import { AlertTriangle, History, RotateCcw, Save } from "lucide-react";
import { AnalyticsPanel } from "../../components/analytics";
import { FeedbackBanner, ToneBadge } from "./admin-ui";
import { DEFAULT_SCORING_WEIGHTS, normalizeScoringWeights, remainingWeight, type ScoringDimension } from "../../lib/scoring-weights";
import { formatErrorMessage, notify } from "../../lib/feedback";
import { ApiError } from "../../lib/api/client";
import { useDirtyGuard } from "../../hooks/useDirtyGuard";

const clampInt = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, value)));
const blockNonDigits = (e: React.KeyboardEvent<HTMLInputElement>) => { if (["-", ".", "e", "E", "+", ","].includes(e.key)) e.preventDefault(); };

const METRICS: { key: ScoringDimension; id: string; label: string; description: string; barColor: string }[] = [
  { key: "SKILLS", id: "skills", label: "Skills", description: "How closely a candidate's skills match the job.", barColor: "bg-[#0B315D]" },
  { key: "EXPERIENCE", id: "experience", label: "Relevant experience", description: "Similar roles, seniority, and industry experience.", barColor: "bg-[#2563EB]" },
  { key: "LOCATION", id: "location", label: "Location", description: "How close the candidate is to the work location.", barColor: "bg-[#047857]" },
  { key: "COMPLIANCE", id: "compliance", label: "Requirements", description: "Readiness to provide required documents.", barColor: "bg-[#B45309]" },
  { key: "EDUCATION_CERTIFICATIONS", id: "education", label: "Education and certifications", description: "Education, training, and required certifications.", barColor: "bg-[#475569]" },
];

const readRevisionWeights = (raw: unknown): Record<ScoringDimension, number> => {
  if (Array.isArray(raw)) {
    const map: Partial<Record<ScoringDimension, number>> = {};
    for (const item of raw) {
      if (item && typeof item === "object" && "dimension" in item && "weight" in item) {
        map[item.dimension as ScoringDimension] = Number(item.weight) || 0;
      }
    }
    return { ...DEFAULT_SCORING_WEIGHTS, ...map };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, number>;
    return {
      SKILLS: Number(obj.SKILLS ?? 0),
      EXPERIENCE: Number(obj.EXPERIENCE ?? 0),
      LOCATION: Number(obj.LOCATION ?? 0),
      COMPLIANCE: Number(obj.COMPLIANCE ?? 0),
      EDUCATION_CERTIFICATIONS: Number(obj.EDUCATION_CERTIFICATIONS ?? 0),
    };
  }
  return DEFAULT_SCORING_WEIGHTS;
};

export const ScoringConfigPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [weights, setWeights] = useState(DEFAULT_SCORING_WEIGHTS);
  const { SKILLS: skillsWeight, EXPERIENCE: experienceWeight, LOCATION: locationWeight,
    COMPLIANCE: complianceWeight, EDUCATION_CERTIFICATIONS: educationWeight } = weights;
  // Raw text while a number box is being edited, so clearing it does not snap to 0 mid-typing.
  const [drafts, setDrafts] = useState<Partial<Record<ScoringDimension, string>>>({});
  const updateWeight = (dimension: ScoringDimension, value: number) => {
    if (!Number.isFinite(value)) return;
    setWeights((current) => ({ ...current, [dimension]: clampInt(value, 0, 100) }));
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
      const message = err instanceof ApiError && err.status === 409
        ? "Someone else changed these settings. Reload the page and try again."
        : formatErrorMessage(err);
      setFeedback({ type: "error", message });
      notify.error("Couldn't save matching settings", message);
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
    ? "Total: 100%"
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

  const dirtyGuard = useDirtyGuard({
    isDirty: hasUnsavedChanges,
    message: "Your matching settings have not been saved.",
  });

  const handleDiscard = () => {
    if (!config) return;
    const w = (config.weights as Record<string, number>) || {};
    setWeights(normalizeScoringWeights(w));
    setDrafts({});
    setMatchThreshold(config.matchThreshold ?? 60);
    setDefaultK(config.knnSettings?.defaultK ?? 10);
    setMaximumK(config.knnSettings?.maximumK ?? 50);
    setMinSimilarity(config.knnSettings?.minimumSimilarity ?? 0.5);
    setFeedback(null);
  };

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

  const breadcrumbs = [
    { label: "Administration", href: "/admin" },
    { label: "Matching settings" },
  ];

  if (configQuery.isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Matching settings" flush breadcrumbs={breadcrumbs} />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (configQuery.isError || !config) {
    return (
      <div className="space-y-5">
        <PageHeader title="Matching settings" flush breadcrumbs={breadcrumbs} />
        <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />
      </div>
    );
  }

  const historyItems = historyQuery.data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Matching settings"
        flush
        description={`Choose how candidate match scores are calculated. Last updated ${formatDate(config.activatedAt)}.`}
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/scoring/quality">View match results</Link>
            </Button>
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
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              loading={restoreDefaultsMutation.isPending}
              onClick={() => setConfirmRestoreOpen(true)}
            >
              Restore default settings
            </Button>
          </div>
        }
      />

      {feedback && <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />}

      <form onSubmit={handleSave} className="space-y-5">
        {/* 5 Dimension Sliders */}
        <AnalyticsPanel
          title="Scoring priorities"
          aside={
            <div className="flex flex-wrap items-center gap-2">
              {totalWeight !== 100 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDrafts({});
                    setWeights((current) => normalizeScoringWeights(current));
                  }}
                >
                  Balance to 100%
                </Button>
              )}
              <span role="status" className={`font-semibold tabular-nums ${isWeightValid ? "text-emerald-800" : "text-rose-700"}`}>
                {allocationText}
              </span>
            </div>
          }
        >
          <div className="p-3.5 space-y-4">
            <p id="scoring-weight-help" className="sr-only">Set each priority. The total must equal 100%.</p>
            <div className="space-y-2">
              <div
                className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
                role="img"
                aria-label={METRICS.map((m) => `${m.label}: ${weights[m.key]}%`).join(", ")}
              >
                {METRICS.map((metric) => {
                  const pct = totalWeight > 100 ? (weights[metric.key] / totalWeight) * 100 : weights[metric.key];
                  return (
                    <div
                      key={metric.key}
                      className={`${metric.barColor} transition-all duration-150`}
                      style={{ width: `${Math.max(0, pct)}%` }}
                      title={`${metric.label}: ${weights[metric.key]}%`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {METRICS.map((metric) => (
                  <span key={metric.key} className="inline-flex items-center gap-1.5 tabular-nums">
                    <span className={`h-2 w-2 rounded-full ${metric.barColor}`} aria-hidden="true" />
                    {metric.label} {weights[metric.key]}%
                  </span>
                ))}
              </div>
            </div>
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
                      onKeyDown={blockNonDigits}
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
                      className="focus-ring w-16 min-h-11 md:min-h-9 px-2 py-1 text-right font-semibold text-slate-950 tabular-nums border border-slate-300 rounded-md"
                    />
                    <span className="text-slate-600">%</span>
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
                <p className="text-xs text-slate-600">
                  {metric.description}
                </p>
              </div>
            ))}
          </div>
        </AnalyticsPanel>

        {/* Candidate AI Match Threshold */}
        <AnalyticsPanel title="Recommended match score">
          <div className="p-3.5 space-y-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-slate-950">Score for automatic recommendation</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={matchThreshold}
                    required
                    onKeyDown={blockNonDigits}
                    onChange={(e) => { if (e.target.value !== "") setMatchThreshold(clampInt(Number(e.target.value), 0, 100)); }}
                    aria-label="Recommended match score"
                    className="w-16 px-2 py-1 text-right"
                  />
                  </div>
                  <span className="text-slate-600">/ 100</span>
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
              <p className="text-xs text-slate-600">
                Candidates scoring {matchThreshold} or higher are recommended automatically. Lower scores stay available for recruiter review. When a job opens, Talent Pool members at or above this score are sent to the recruiter as a notification.
              </p>
            </div>
          </div>
        </AnalyticsPanel>

        {/* Save Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-300 bg-white p-3.5">
          <div className="text-sm">
            {isWeightValid && isKnnValid && Number.isInteger(matchThreshold) && matchThreshold >= 0 && matchThreshold <= 100 ? (
              <span className="text-slate-600" role="status">Ready to save</span>
            ) : (
              <span className="text-rose-800 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-700" aria-hidden="true" /> {isWeightValid ? "Review the threshold." : `${allocationText}`}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasUnsavedChanges && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={handleDiscard}
              >
                Discard changes
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={!hasUnsavedChanges || !isWeightValid || !isKnnValid || !Number.isInteger(matchThreshold) || matchThreshold < 0 || matchThreshold > 100}
              loading={updateConfigMutation.isPending}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save matching settings
            </Button>
          </div>
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
            <p className="text-sm text-slate-600 py-4 text-center">No earlier settings have been saved.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyItems.map((h) => {
                const w = readRevisionWeights(h.weights);
                return (
                  <div key={h.id} className="py-3 text-sm space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">Revision {h.revision}</span>
                        <ToneBadge tone={h.status === "ACTIVE" ? "success" : "neutral"}>
                          {h.status === "ACTIVE" ? "Active" : "Previous"}
                        </ToneBadge>
                      </div>
                      <span className="text-xs text-slate-600 tabular-nums">
                        {formatDateTime(h.activatedAt)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 tabular-nums">
                      Skills {w.SKILLS}% · Experience {w.EXPERIENCE}% · Location {w.LOCATION}% · Requirements {w.COMPLIANCE}% · Education {w.EDUCATION_CERTIFICATIONS}%
                      {h.matchThreshold !== undefined ? ` · Threshold ${h.matchThreshold}/100` : ""}
                    </div>
                    <div className="text-xs text-slate-600">
                      Saved by: {h.activatedBy?.email || "Administrator"}
                    </div>
                  </div>
                );
              })}
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
      {dirtyGuard.discardDialog}
    </div>
  );
};
