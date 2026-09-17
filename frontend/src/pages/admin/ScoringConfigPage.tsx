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
import { notify } from "../../lib/feedback";

export const ScoringConfigPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [skillsWeight, setSkillsWeight] = useState<number>(30);
  const [experienceWeight, setExperienceWeight] = useState<number>(25);
  const [locationWeight, setLocationWeight] = useState<number>(15);
  const [complianceWeight, setComplianceWeight] = useState<number>(15);
  const [educationWeight, setEducationWeight] = useState<number>(15);

  const [matchThreshold, setMatchThreshold] = useState<number>(60);
  const [defaultK, setDefaultK] = useState<number>(10);
  const [maximumK, setMaximumK] = useState<number>(50);
  const [minSimilarity, setMinSimilarity] = useState<number>(0.5);
  const [excludeCurrentlyHired, setExcludeCurrentlyHired] = useState<boolean>(true);

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
      if (w.SKILLS !== undefined) setSkillsWeight(w.SKILLS);
      if (w.EXPERIENCE !== undefined) setExperienceWeight(w.EXPERIENCE);
      if (w.LOCATION !== undefined) setLocationWeight(w.LOCATION);
      if (w.COMPLIANCE !== undefined) setComplianceWeight(w.COMPLIANCE);
      if (w.EDUCATION_CERTIFICATIONS !== undefined) setEducationWeight(w.EDUCATION_CERTIFICATIONS);

      if (config.matchThreshold !== undefined) setMatchThreshold(config.matchThreshold);

      if (config.knnSettings) {
        if (config.knnSettings.defaultK !== undefined) setDefaultK(config.knnSettings.defaultK);
        if (config.knnSettings.maximumK !== undefined) setMaximumK(config.knnSettings.maximumK);
        if (config.knnSettings.minimumSimilarity !== undefined) setMinSimilarity(config.knnSettings.minimumSimilarity);
        if (config.knnSettings.excludeCurrentlyHired !== undefined)
          setExcludeCurrentlyHired(config.knnSettings.excludeCurrentlyHired);
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

  const totalWeight =
    skillsWeight + experienceWeight + locationWeight + complianceWeight + educationWeight;
  const isWeightValid = totalWeight === 100;
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
      minSimilarity !== (config.knnSettings?.minimumSimilarity ?? 0.5) ||
      excludeCurrentlyHired !== (config.knnSettings?.excludeCurrentlyHired ?? true)
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
    if (matchThreshold < 0 || matchThreshold > 100) {
      setFeedback({
        type: "error",
        message: "The recommended match score must be a whole number from 0 to 100.",
      });
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
        excludeCurrentlyHired,
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
          <div className="flex items-center gap-2">
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
              ? "bg-teal-50 border-teal-700 text-teal-950"
              : "bg-rose-50 border-rose-700 text-rose-950"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-teal-700" />
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
      <div className="bg-white border border-slate-300 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div>
          <span className="text-slate-500 font-semibold">Current settings: </span>
          <span className="font-bold text-slate-950">
            Last updated {formatDate(config.activatedAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
           <span className="text-slate-500">Weights total:</span>
          <span
            className={`font-bold px-2 py-0.5 border ${
              isWeightValid
                ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                : "bg-rose-50 text-rose-900 border-rose-300"
            }`}
          >
            {totalWeight}% {isWeightValid ? "✓ Ready" : "⚠ Must equal 100%"}
          </span>
          {!isWeightValid && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                if (totalWeight <= 0) {
                  setSkillsWeight(30);
                  setExperienceWeight(25);
                  setLocationWeight(15);
                  setComplianceWeight(15);
                  setEducationWeight(15);
                  return;
                }
                const ratio = 100 / totalWeight;
                const newSkills = Math.round(skillsWeight * ratio);
                const newExp = Math.round(experienceWeight * ratio);
                const newLoc = Math.round(locationWeight * ratio);
                const newComp = Math.round(complianceWeight * ratio);
                const newEdu = 100 - (newSkills + newExp + newLoc + newComp);
                setSkillsWeight(newSkills);
                setExperienceWeight(newExp);
                setLocationWeight(newLoc);
                setComplianceWeight(newComp);
                setEducationWeight(Math.max(0, newEdu));
              }}
            >
               Balance to 100%
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* 5 Dimension Sliders */}
        <div className="bg-white border border-slate-300">
          <div className="p-3 border-b border-slate-300 flex items-center gap-2 bg-slate-100">
            <Sliders className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-semibold text-slate-900">
              Scoring priorities
            </h3>
          </div>

          <div className="p-4 space-y-4">
            {/* 1. Skills Match */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="skills-weight" className="font-semibold text-slate-950">Skills</label>
                <span className="font-mono font-bold text-teal-900 tabular-nums">{skillsWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                 id="skills-weight"
                 aria-label="Skills weight"
                 value={skillsWeight}
                onChange={(e) => setSkillsWeight(Number(e.target.value))}
                 className="w-full h-11 accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                How closely a candidate's skills match the job.
              </p>
            </div>

            {/* 2. Experience Fit */}
            <div className="space-y-1.5 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-xs">
                <label htmlFor="experience-weight" className="font-semibold text-slate-950">Relevant experience</label>
                <span className="font-mono font-bold text-teal-900 tabular-nums">{experienceWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                 id="experience-weight"
                 aria-label="Relevant experience weight"
                 value={experienceWeight}
                onChange={(e) => setExperienceWeight(Number(e.target.value))}
                 className="w-full h-11 accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Similar roles, seniority, and industry experience.
              </p>
            </div>

            {/* 3. Location Proximity */}
            <div className="space-y-1.5 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-xs">
                <label htmlFor="location-weight" className="font-semibold text-slate-950">Location</label>
                <span className="font-mono font-bold text-teal-900 tabular-nums">{locationWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                 id="location-weight"
                 aria-label="Location weight"
                 value={locationWeight}
                onChange={(e) => setLocationWeight(Number(e.target.value))}
                 className="w-full h-11 accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                How close the candidate is to the work location.
              </p>
            </div>

            {/* 4. Requirements */}
            <div className="space-y-1.5 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-xs">
                <label htmlFor="compliance-weight" className="font-semibold text-slate-950">Requirements</label>
                <span className="font-mono font-bold text-teal-900 tabular-nums">{complianceWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                 id="compliance-weight"
                 aria-label="Requirements weight"
                 value={complianceWeight}
                onChange={(e) => setComplianceWeight(Number(e.target.value))}
                 className="w-full h-11 accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Readiness to provide required documents.
              </p>
            </div>

            {/* 5. Education & Certifications */}
            <div className="space-y-1.5 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-xs">
                <label htmlFor="education-weight" className="font-semibold text-slate-950">Education and certifications</label>
                <span className="font-mono font-bold text-teal-900 tabular-nums">{educationWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                 id="education-weight"
                 aria-label="Education and certifications weight"
                 value={educationWeight}
                onChange={(e) => setEducationWeight(Number(e.target.value))}
                 className="w-full h-11 accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Education, training, and required certifications.
              </p>
            </div>
          </div>
        </div>

        {/* Candidate AI Match Threshold */}
        <div className="bg-white border border-slate-300">
          <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                 Recommended match score
              </h3>
            </div>
            <span className="font-mono font-bold text-xs text-teal-900 bg-teal-50 px-2 py-0.5 border border-teal-200">
               Recommend at: {matchThreshold} / 100
            </span>
          </div>

          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                 <span className="font-semibold text-slate-950 text-sm">
                   Score for automatic recommendation
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={matchThreshold}
                    onChange={(e) => setMatchThreshold(Math.min(100, Math.max(0, Number(e.target.value))))}
                     aria-label="Recommended match score"
                     className="w-16 px-2 py-1 text-sm border border-slate-300 focus:outline-none focus:border-teal-700 text-right"
                  />
                  <span className="font-mono text-slate-500">/ 100</span>
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
                 className="w-full h-11 accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Candidates scoring {matchThreshold} or higher are recommended automatically. Lower scores stay available for recruiter review.
              </p>
            </div>
          </div>
        </div>

        {/* Talent Discovery & Match Parameters */}
        <div className="bg-white border border-slate-300">
          <div className="p-3 border-b border-slate-300 flex items-center gap-2 bg-slate-100">
            <Sliders className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-semibold text-slate-900">
              Who to include in matching
            </h3>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeCurrentlyHired}
                  onChange={(e) => setExcludeCurrentlyHired(e.target.checked)}
                  className="rounded-none border-slate-300 text-teal-700 focus:ring-0 w-4 h-4"
                />
                <span>Leave currently deployed employees out of matching</span>
              </label>
            </div>

            <details className="group border border-slate-200 rounded-md p-3">
              <summary className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center justify-between">
                 Advanced matching options
              </summary>
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                   label="Results shown by default"
                  type="number"
                  min={1}
                  max={50}
                  value={defaultK}
                  onChange={(e) => setDefaultK(Number(e.target.value))}
                />
                <Input
                   label="Maximum results"
                  type="number"
                  min={10}
                  max={100}
                  value={maximumK}
                  onChange={(e) => setMaximumK(Number(e.target.value))}
                />
                <Input
                   label="Lowest accepted similarity (0–1)"
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  value={minSimilarity}
                  onChange={(e) => setMinSimilarity(Number(e.target.value))}
                />
              </div>
            </details>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between p-3.5 bg-white border border-slate-300">
          <div className="text-xs font-mono">
            {isWeightValid ? (
              <span className="text-emerald-800 font-bold flex items-center gap-1.5" role="status">
                 <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Ready to save
              </span>
            ) : (
              <span className="text-rose-800 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-700" /> Match factors total {totalWeight}% (must equal 100%)
              </span>
            )}
          </div>

          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={!isWeightValid}
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
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No earlier settings have been saved.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyItems.map((h) => (
                <div key={h.id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 font-mono">
                       Saved settings {h.revision} ({h.status})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDateTime(h.activatedAt)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
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
