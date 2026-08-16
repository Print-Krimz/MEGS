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
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  History,
  Save,
} from "lucide-react";

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
      setFeedback({ type: "success", message: "Candidate scoring criteria updated successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to update scoring configuration: " + err.message });
    },
  });

  const restoreDefaultsMutation = useMutation({
    mutationFn: adminApi.restoreDefaultScoringConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scoring"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setConfirmRestoreOpen(false);
      setFeedback({ type: "success", message: "Default scoring configuration restored!" });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to restore defaults: " + err.message });
    },
  });

  const totalWeight =
    skillsWeight + experienceWeight + locationWeight + complianceWeight + educationWeight;
  const isWeightValid = totalWeight === 100;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightValid) {
      setFeedback({
        type: "error",
        message: `Scoring weights must sum to exactly 100%. Current sum: ${totalWeight}%`,
      });
      return;
    }
    if (matchThreshold < 0 || matchThreshold > 100) {
      setFeedback({
        type: "error",
        message: "Match threshold must be an integer between 0 and 100.",
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
        <PageHeader title="Candidate Match Scoring Configuration" description="Loading criteria..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (configQuery.isError || !config) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Match Scoring Configuration" description="Scoring criteria" />
        <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />
      </div>
    );
  }

  const historyItems = historyQuery.data || [];

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title="Candidate Match Scoring Configuration"
        description="Set evaluation criteria weights and match thresholds for candidate scoring"
        breadcrumbs={[
          { label: "Admin Operations", href: "/admin" },
          { label: "Scoring Configuration" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<History className="w-3.5 h-3.5" />}
              onClick={() => setHistoryModalOpen(true)}
            >
              Revision History
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-700" />}
              loading={restoreDefaultsMutation.isPending}
              onClick={() => setConfirmRestoreOpen(true)}
            >
              Restore Defaults
            </Button>
          </div>
        }
      />

      {feedback && (
        <div
          className={`p-3 border-l-4 border text-xs font-mono flex items-center justify-between ${
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
            className="text-slate-400 hover:text-slate-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Revision Meta Snapshot */}
      <div className="bg-white border border-slate-300 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div>
          <span className="text-slate-500 uppercase font-bold">Active Configuration: </span>
          <span className="font-bold text-slate-950">
            Version {config.version}, Revision {config.revision}
          </span>
          <span className="text-slate-500"> • Activated: {formatDate(config.activatedAt)}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 uppercase">Weight Total:</span>
          <span
            className={`font-bold px-2 py-0.5 border ${
              isWeightValid
                ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                : "bg-rose-50 text-rose-900 border-rose-300"
            }`}
          >
            {totalWeight}% {isWeightValid ? "✓ Valid (100%)" : "⚠ Must Equal 100%"}
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
              Auto-Balance to 100%
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* 5 Dimension Sliders */}
        <div className="bg-white border border-slate-300">
          <div className="p-3 border-b border-slate-300 flex items-center gap-2 bg-slate-100">
            <Sparkles className="w-4 h-4 text-teal-700" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
              Evaluation Criteria Weights
            </h3>
          </div>

          <div className="p-4 space-y-4">
            {/* 1. Skills Match */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-950 uppercase font-mono">1. Skills & Technical Competencies</span>
                <span className="font-mono font-bold text-teal-900 tabular-nums">{skillsWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={skillsWeight}
                onChange={(e) => setSkillsWeight(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Measures candidate skill alignment against job requirements.
              </p>
            </div>

            {/* 2. Experience Fit */}
            <div className="space-y-1.5 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-950 uppercase font-mono">2. Relevant Work Experience</span>
                <span className="font-mono font-bold text-teal-900 tabular-nums">{experienceWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={experienceWeight}
                onChange={(e) => setExperienceWeight(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Evaluates years in similar roles, seniority, and industry domain experience.
              </p>
            </div>

            {/* 3. Location Proximity */}
            <div className="space-y-1.5 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-950 uppercase font-mono">3. Geographic Proximity / Location</span>
                <span className="font-mono font-bold text-teal-900 tabular-nums">{locationWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={locationWeight}
                onChange={(e) => setLocationWeight(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Measures candidate proximity to job and client work locations.
              </p>
            </div>

            {/* 4. 201 Compliance */}
            <div className="space-y-1.5 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-950 uppercase font-mono">4. Pre-Employment 201 Readiness</span>
                <span className="font-mono font-bold text-teal-900 tabular-nums">{complianceWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={complianceWeight}
                onChange={(e) => setComplianceWeight(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Evaluates pre-employment documentation and government requirement readiness.
              </p>
            </div>

            {/* 5. Education & Certifications */}
            <div className="space-y-1.5 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-950 uppercase font-mono">5. Education & Certifications</span>
                <span className="font-mono font-bold text-teal-900 tabular-nums">{educationWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={educationWeight}
                onChange={(e) => setEducationWeight(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Evaluates educational attainment, technical training, and required certifications.
              </p>
            </div>
          </div>
        </div>

        {/* Candidate AI Match Threshold */}
        <div className="bg-white border border-slate-300">
          <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-700" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
                Candidate AI Match Threshold
              </h3>
            </div>
            <span className="font-mono font-bold text-xs text-teal-900 bg-teal-50 px-2 py-0.5 border border-teal-200">
              Pass Cutoff: {matchThreshold} / 100
            </span>
          </div>

          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-950 uppercase font-mono">
                  Auto-Categorization Threshold
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={matchThreshold}
                    onChange={(e) => setMatchThreshold(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-16 px-2 py-1 text-xs font-mono border border-slate-300 focus:outline-none focus:border-teal-700 text-right"
                  />
                  <span className="font-mono text-slate-500">/ 100</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={matchThreshold}
                onChange={(e) => setMatchThreshold(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Candidates scoring at or above <strong className="font-mono text-slate-800">{matchThreshold}</strong> are automatically categorized as <span className="font-mono font-bold text-emerald-800">MATCHED</span>. Candidates scoring below default to <span className="font-mono font-bold text-amber-800">REVIEW</span> for manual Talent Acquisition intervention.
              </p>
            </div>
          </div>
        </div>

        {/* Talent Discovery & Match Parameters */}
        <div className="bg-white border border-slate-300">
          <div className="p-3 border-b border-slate-300 flex items-center gap-2 bg-slate-100">
            <Sliders className="w-4 h-4 text-teal-700" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
              Talent Discovery & Match Parameters
            </h3>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Default Match Results Count"
                type="number"
                min={1}
                max={50}
                value={defaultK}
                onChange={(e) => setDefaultK(Number(e.target.value))}
              />
              <Input
                label="Maximum Match Results Limit"
                type="number"
                min={10}
                max={100}
                value={maximumK}
                onChange={(e) => setMaximumK(Number(e.target.value))}
              />
              <Input
                label="Minimum Match Threshold (0.0 - 1.0)"
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={minSimilarity}
                onChange={(e) => setMinSimilarity(Number(e.target.value))}
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeCurrentlyHired}
                  onChange={(e) => setExcludeCurrentlyHired(e.target.checked)}
                  className="rounded-none border-slate-300 text-teal-700 focus:ring-0 w-4 h-4"
                />
                <span>Exclude currently deployed employees from matching pool</span>
              </label>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between p-3.5 bg-white border border-slate-300">
          <div className="text-xs font-mono">
            {isWeightValid ? (
              <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Ready to activate revision #{config.revision + 1}
              </span>
            ) : (
              <span className="text-rose-800 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-700" /> Weights total {totalWeight}% (must equal 100%)
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
            Save & Apply Scoring Weights
          </Button>
        </div>
      </form>

      {/* Revision History Modal */}
      <Dialog
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Scoring Configuration History"
        description="Audit trail of previous scoring criteria revisions and activations"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          {historyQuery.isLoading ? (
            <LoadingState variant="table" rows={3} />
          ) : historyItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No previous revisions on record.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyItems.map((h) => (
                <div key={h.id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 font-mono">
                      Revision {h.revision} ({h.status})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDateTime(h.activatedAt)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Activated by: {h.activatedBy?.email || "Admin"}
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
        title="Restore Default Scoring Configuration?"
        description="This will restore the default evaluation weights (30% Skills, 25% Experience, 15% Location, 15% Compliance, 15% Education) and reset matching thresholds. This will create a new configuration revision."
        confirmLabel="Restore Defaults"
        variant="warning"
        loading={restoreDefaultsMutation.isPending}
      />
    </div>
  );
};
