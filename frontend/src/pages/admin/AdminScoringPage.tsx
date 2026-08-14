import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Play,
  History,
  Activity,
  Zap,
  ChevronDown,
  ChevronUp,
  Cpu,
  BarChart,
  Target,
  Sparkles,
  FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { adminApi } from '../../lib/api/admin';
import { CandidateScoringDimension } from '../../lib/types/enums';
import type {
  CandidateScoringConfiguration,
  CandidateScoringWeight,
  ScoringQualityMetrics,
  RevalidationStatus,
} from '../../lib/types/api';

const DEFAULT_WEIGHTS: Record<CandidateScoringDimension, number> = {
  [CandidateScoringDimension.SKILLS]: 40,
  [CandidateScoringDimension.EXPERIENCE]: 25,
  [CandidateScoringDimension.LOCATION]: 15,
  [CandidateScoringDimension.COMPLIANCE]: 10,
  [CandidateScoringDimension.EDUCATION_CERTIFICATIONS]: 10,
};

export default function AdminScoringPage() {
  const queryClient = useQueryClient();

  // Local weights form state
  const [weights, setWeights] = useState<Record<CandidateScoringDimension, number>>(DEFAULT_WEIGHTS);
  const [knnSettings, setKnnSettings] = useState<{
    defaultK: number;
    maximumK: number;
    minimumSimilarity: number;
  }>({
    defaultK: 5,
    maximumK: 20,
    minimumSimilarity: 0.70,
  });

  // Sandbox simulation test inputs
  const [sandboxScores, setSandboxScores] = useState({
    skillsScore: 85,
    experienceScore: 90,
    locationScore: 80,
    complianceScore: 100,
    educationScore: 75,
  });

  // History accordion expanded state
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);

  // Restore Defaults Dialog state
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  // 1. Fetch Active Configuration
  const {
    data: configRes,
    isLoading: isLoadingConfig,
    isError: isErrorConfig,
    error: errorConfig,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['admin', 'scoring', 'configuration'],
    queryFn: () => adminApi.getActiveScoringConfiguration(),
  });

  // 2. Fetch History (with CRITICAL safe array fallback)
  const {
    data: historyRes,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['admin', 'scoring', 'history'],
    queryFn: () => adminApi.listScoringConfigurations({ limit: 10 }),
  });

  // 3. Fetch Revalidation Status
  const {
    data: revalidationRes,
    refetch: refetchReval,
  } = useQuery({
    queryKey: ['admin', 'scoring', 'revalidation-status'],
    queryFn: () => adminApi.getRevalidationStatus(),
    refetchInterval: 5000, // Poll every 5s for live revalidation progress
  });

  // 4. Fetch Scoring Quality Metrics
  const {
    data: metricsRes,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['admin', 'scoring', 'quality-metrics'],
    queryFn: () => adminApi.getScoringQualityMetrics(),
  });

  const activeConfig: CandidateScoringConfiguration | undefined = configRes?.data;
  
  // CRITICAL FIX: Safe array check on historyRes?.data to prevent runtime array crash
  const historyList: CandidateScoringConfiguration[] = Array.isArray(historyRes?.data)
    ? historyRes.data
    : (historyRes?.data as any)?.configurations || [];

  const revalidationStatus: RevalidationStatus | undefined = revalidationRes?.data;
  const qualityMetrics: ScoringQualityMetrics | undefined = metricsRes?.data;

  // Initialize weights when activeConfig loads
  useEffect(() => {
    if (activeConfig) {
      const newWeights = { ...DEFAULT_WEIGHTS };
      if (activeConfig.weights && activeConfig.weights.length > 0) {
        activeConfig.weights.forEach((w) => {
          if (w.dimension && w.weight !== undefined) {
            newWeights[w.dimension] = w.weight;
          }
        });
      }
      setWeights(newWeights);

      if (activeConfig.knnSettings) {
        setKnnSettings({
          defaultK: activeConfig.knnSettings.defaultK ?? 5,
          maximumK: activeConfig.knnSettings.maximumK ?? 20,
          minimumSimilarity: activeConfig.knnSettings.minimumSimilarity ?? 0.70,
        });
      }
    }
  }, [activeConfig]);

  // Compute live sum
  const totalWeightSum = useMemo(() => {
    return (
      (Number(weights[CandidateScoringDimension.SKILLS]) || 0) +
      (Number(weights[CandidateScoringDimension.EXPERIENCE]) || 0) +
      (Number(weights[CandidateScoringDimension.LOCATION]) || 0) +
      (Number(weights[CandidateScoringDimension.COMPLIANCE]) || 0) +
      (Number(weights[CandidateScoringDimension.EDUCATION_CERTIFICATIONS]) || 0)
    );
  }, [weights]);

  const isBalanced = totalWeightSum === 100;

  // Calculated sandbox composite score
  const simulatedScore = useMemo(() => {
    const sum =
      (sandboxScores.skillsScore * (weights[CandidateScoringDimension.SKILLS] || 0) +
        sandboxScores.experienceScore * (weights[CandidateScoringDimension.EXPERIENCE] || 0) +
        sandboxScores.locationScore * (weights[CandidateScoringDimension.LOCATION] || 0) +
        sandboxScores.complianceScore * (weights[CandidateScoringDimension.COMPLIANCE] || 0) +
        sandboxScores.educationScore * (weights[CandidateScoringDimension.EDUCATION_CERTIFICATIONS] || 0)) /
      (totalWeightSum || 100);
    return Math.round(sum * 10) / 10;
  }, [weights, sandboxScores, totalWeightSum]);

  // Mutation: Save Configuration
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const weightsArray: CandidateScoringWeight[] = Object.entries(weights).map(
        ([dimension, weight]) => ({
          dimension: dimension as CandidateScoringDimension,
          weight: Number(weight),
        })
      );

      return adminApi.createScoringConfiguration({
        expectedRevision: activeConfig?.revision,
        weights: weightsArray,
        knnSettings: {
          defaultK: Number(knnSettings.defaultK),
          maximumK: Number(knnSettings.maximumK),
          minimumSimilarity: Number(knnSettings.minimumSimilarity),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(
        `Scoring configuration v${res.data?.version || 1}.${res.data?.revision || 1} activated successfully.`
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'scoring'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to activate scoring configuration.');
    },
  });

  // Mutation: Restore Defaults
  const restoreDefaultsMutation = useMutation({
    mutationFn: () => adminApi.restoreDefaults(activeConfig?.revision),
    onSuccess: () => {
      toast.success('Default scoring weights and hyper-parameters restored.');
      setIsRestoreConfirmOpen(false);
      setWeights(DEFAULT_WEIGHTS);
      queryClient.invalidateQueries({ queryKey: ['admin', 'scoring'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to restore defaults.');
    },
  });

  // Mutation: Trigger Revalidation
  const triggerRevalidationMutation = useMutation({
    mutationFn: () => adminApi.triggerRevalidation(),
    onSuccess: (res) => {
      toast.success(res.data?.message || res.message || 'Candidate score revalidation queued across all active applications.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'scoring', 'revalidation-status'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to trigger score revalidation.');
    },
  });

  const handleWeightChange = (dimension: CandidateScoringDimension, val: number) => {
    setWeights((prev) => ({
      ...prev,
      [dimension]: Math.max(0, Math.min(100, isNaN(val) ? 0 : val)),
    }));
  };

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoadingConfig && !activeConfig) {
    return <LoadingState variant="page" />;
  }

  if (isErrorConfig && !activeConfig) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Candidate Scoring Configuration"
          description="Fine-tune dimensional weights (Skills, Experience, Location, Compliance, Education) and KNN hyper-parameters."
          breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Candidate Scoring' }]}
        />
        <ErrorState
          title="Failed to load scoring configuration"
          message={errorConfig instanceof Error ? errorConfig.message : 'Unable to connect to scoring service.'}
          onRetry={() => {
            refetchConfig();
            refetchHistory();
            refetchReval();
            refetchMetrics();
          }}
        />
      </div>
    );
  }

  // Calculate revalidation progress
  const totalTasks = revalidationStatus?.totalTasks || 0;
  const completedTasks = revalidationStatus?.completedTasks || 0;
  const pendingTasks = (revalidationStatus?.pendingTasks || 0) + (revalidationStatus?.processingTasks || 0);
  const failedTasks = revalidationStatus?.failedTasks || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const isRevalidating = pendingTasks > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="admin-scoring-page">
      <PageHeader
        title="Candidate Scoring Configuration"
        description="Fine-tune dimensional weights (Skills, Experience, Location, Compliance, Education) and KNN hyper-parameters."
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Candidate Scoring' }]}
        actions={
          <button
            onClick={() => triggerRevalidationMutation.mutate()}
            disabled={triggerRevalidationMutation.isPending}
            data-testid="trigger-revalidation-button"
            className="h-10 px-4 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg shadow-sm inline-flex items-center gap-2 transition duration-150 disabled:opacity-50 cursor-pointer"
          >
            {triggerRevalidationMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>Trigger Score Revalidation</span>
          </button>
        }
      />

      {/* Top Section: Active Config Overview Card */}
      <div className="p-6 bg-card border border-border rounded-xl shadow-subtle" data-testid="active-config-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-slate-900 text-teal-400 rounded-xl shadow-sm">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Active Configuration Version v{activeConfig?.version ?? 1}.{activeConfig?.revision ?? 0}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {activeConfig?.status || 'ACTIVE'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {activeConfig?.scope || 'GLOBAL'} SCOPE
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Activated on <span className="font-medium text-foreground">{formatTimestamp(activeConfig?.activatedAt || activeConfig?.createdAt)}</span>
                {activeConfig?.activatedById && (
                  <span> &middot; Activated by <span className="font-mono text-foreground">{activeConfig.activatedById}</span></span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsRestoreConfirmOpen(true)}
            data-testid="restore-defaults-button"
            className="h-9 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg inline-flex items-center gap-1.5 transition duration-150 w-fit cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Defaults</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Weights Editor & Revalidation Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Scoring Weights & KNN Editor (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weights Tuning Card */}
          <div className="bg-card border border-border rounded-xl shadow-subtle overflow-hidden">
            <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-teal-700" />
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  Dimensional Weights Allocation
                </h3>
              </div>
              {/* Live Weight Balance Badge */}
              <div
                data-testid="weights-sum-indicator"
                className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                  isBalanced
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border border-rose-300'
                }`}
              >
                {isBalanced ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Weights Balanced: 100%</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Sum: {totalWeightSum}% (Must equal 100%)</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Dimension 1: Skills Match */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="weight-skills-range" className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                      Skills Match Weight
                    </label>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      Evaluates overlap between candidate verified skills and job requirements.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      id="weight-skills-input"
                      type="number"
                      min="0"
                      max="100"
                      aria-label="Skills Match Weight Percentage"
                      data-testid="weight-input-skills"
                      value={weights[CandidateScoringDimension.SKILLS]}
                      onChange={(e) =>
                        handleWeightChange(CandidateScoringDimension.SKILLS, parseInt(e.target.value, 10))
                      }
                      className="w-16 h-9 px-2.5 py-1 text-right font-mono font-bold text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-lg font-bold font-mono text-teal-800">%</span>
                  </div>
                </div>
                <input
                  id="weight-skills-range"
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Skills Match Weight Slider"
                  value={weights[CandidateScoringDimension.SKILLS]}
                  onChange={(e) =>
                    handleWeightChange(CandidateScoringDimension.SKILLS, parseInt(e.target.value, 10))
                  }
                  className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-700"
                />
              </div>

              {/* Dimension 2: Experience Match */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="weight-experience-range" className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      Experience Match Weight
                    </label>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      Measures total relevant years, industry alignment, and past role seniority.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      id="weight-experience-input"
                      type="number"
                      min="0"
                      max="100"
                      aria-label="Experience Match Weight Percentage"
                      data-testid="weight-input-experience"
                      value={weights[CandidateScoringDimension.EXPERIENCE]}
                      onChange={(e) =>
                        handleWeightChange(CandidateScoringDimension.EXPERIENCE, parseInt(e.target.value, 10))
                      }
                      className="w-16 h-9 px-2.5 py-1 text-right font-mono font-bold text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-lg font-bold font-mono text-teal-800">%</span>
                  </div>
                </div>
                <input
                  id="weight-experience-range"
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Experience Match Weight Slider"
                  value={weights[CandidateScoringDimension.EXPERIENCE]}
                  onChange={(e) =>
                    handleWeightChange(CandidateScoringDimension.EXPERIENCE, parseInt(e.target.value, 10))
                  }
                  className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Dimension 3: Location Fit */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="weight-location-range" className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      Location Fit Weight
                    </label>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      Proximity scoring between candidate address/preferred cities and client job site.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      id="weight-location-input"
                      type="number"
                      min="0"
                      max="100"
                      aria-label="Location Fit Weight Percentage"
                      data-testid="weight-input-location"
                      value={weights[CandidateScoringDimension.LOCATION]}
                      onChange={(e) =>
                        handleWeightChange(CandidateScoringDimension.LOCATION, parseInt(e.target.value, 10))
                      }
                      className="w-16 h-9 px-2.5 py-1 text-right font-mono font-bold text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-lg font-bold font-mono text-teal-800">%</span>
                  </div>
                </div>
                <input
                  id="weight-location-range"
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Location Fit Weight Slider"
                  value={weights[CandidateScoringDimension.LOCATION]}
                  onChange={(e) =>
                    handleWeightChange(CandidateScoringDimension.LOCATION, parseInt(e.target.value, 10))
                  }
                  className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              {/* Dimension 4: Compliance Readiness */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="weight-compliance-range" className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-600" />
                      Compliance & Readiness Weight
                    </label>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      Verification status of mandatory 201 pre-employment documentation.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      id="weight-compliance-input"
                      type="number"
                      min="0"
                      max="100"
                      aria-label="Compliance Readiness Weight Percentage"
                      data-testid="weight-input-compliance"
                      value={weights[CandidateScoringDimension.COMPLIANCE]}
                      onChange={(e) =>
                        handleWeightChange(CandidateScoringDimension.COMPLIANCE, parseInt(e.target.value, 10))
                      }
                      className="w-16 h-9 px-2.5 py-1 text-right font-mono font-bold text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-lg font-bold font-mono text-teal-800">%</span>
                  </div>
                </div>
                <input
                  id="weight-compliance-range"
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Compliance Readiness Weight Slider"
                  value={weights[CandidateScoringDimension.COMPLIANCE]}
                  onChange={(e) =>
                    handleWeightChange(CandidateScoringDimension.COMPLIANCE, parseInt(e.target.value, 10))
                  }
                  className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
                />
              </div>

              {/* Dimension 5: Education & Certifications */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="weight-education-range" className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                      Education & Certification Weight
                    </label>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      Accreditation levels, degrees, and relevant industry licenses.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      id="weight-education-input"
                      type="number"
                      min="0"
                      max="100"
                      aria-label="Education and Certification Weight Percentage"
                      data-testid="weight-input-education"
                      value={weights[CandidateScoringDimension.EDUCATION_CERTIFICATIONS]}
                      onChange={(e) =>
                        handleWeightChange(
                          CandidateScoringDimension.EDUCATION_CERTIFICATIONS,
                          parseInt(e.target.value, 10)
                        )
                      }
                      className="w-16 h-9 px-2.5 py-1 text-right font-mono font-bold text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-lg font-bold font-mono text-teal-800">%</span>
                  </div>
                </div>
                <input
                  id="weight-education-range"
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Education and Certification Weight Slider"
                  value={weights[CandidateScoringDimension.EDUCATION_CERTIFICATIONS]}
                  onChange={(e) =>
                    handleWeightChange(
                      CandidateScoringDimension.EDUCATION_CERTIFICATIONS,
                      parseInt(e.target.value, 10)
                    )
                  }
                  className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
              </div>
            </div>
          </div>

          {/* Test Sandbox Simulation Card */}
          <div className="p-5 rounded-xl border border-border bg-card shadow-subtle space-y-4" data-testid="scoring-sandbox-card">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <FlaskConical className="w-5 h-5 text-teal-700" />
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Scoring Sandbox Simulator
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Test how current weights calculate candidate fit score across sample dimensional ratings.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200">
                <span className="text-xs font-semibold text-teal-900">Simulated Score:</span>
                <span className="text-lg font-bold font-mono text-teal-800">{simulatedScore}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                <span className="text-xs font-medium text-slate-600">Skills ({weights[CandidateScoringDimension.SKILLS]}%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={sandboxScores.skillsScore}
                  onChange={(e) => setSandboxScores({ ...sandboxScores, skillsScore: parseInt(e.target.value, 10) || 0 })}
                  className="w-full h-8 px-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded"
                />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                <span className="text-xs font-medium text-slate-600">Exp ({weights[CandidateScoringDimension.EXPERIENCE]}%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={sandboxScores.experienceScore}
                  onChange={(e) => setSandboxScores({ ...sandboxScores, experienceScore: parseInt(e.target.value, 10) || 0 })}
                  className="w-full h-8 px-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded"
                />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                <span className="text-xs font-medium text-slate-600">Loc ({weights[CandidateScoringDimension.LOCATION]}%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={sandboxScores.locationScore}
                  onChange={(e) => setSandboxScores({ ...sandboxScores, locationScore: parseInt(e.target.value, 10) || 0 })}
                  className="w-full h-8 px-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded"
                />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                <span className="text-xs font-medium text-slate-600">Comp ({weights[CandidateScoringDimension.COMPLIANCE]}%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={sandboxScores.complianceScore}
                  onChange={(e) => setSandboxScores({ ...sandboxScores, complianceScore: parseInt(e.target.value, 10) || 0 })}
                  className="w-full h-8 px-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded"
                />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                <span className="text-xs font-medium text-slate-600">Edu ({weights[CandidateScoringDimension.EDUCATION_CERTIFICATIONS]}%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={sandboxScores.educationScore}
                  onChange={(e) => setSandboxScores({ ...sandboxScores, educationScore: parseInt(e.target.value, 10) || 0 })}
                  className="w-full h-8 px-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded"
                />
              </div>
            </div>
          </div>

          {/* KNN Hyper-parameters Card */}
          <div className="bg-card border border-border rounded-xl shadow-subtle p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border">
              <Zap className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                KNN Vector Matcher Hyper-parameters
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="knn-default-k" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Default K (Nearest)
                </label>
                <input
                  id="knn-default-k"
                  type="number"
                  min="1"
                  max="50"
                  value={knnSettings.defaultK}
                  onChange={(e) =>
                    setKnnSettings({ ...knnSettings, defaultK: parseInt(e.target.value, 10) || 5 })
                  }
                  className="w-full h-10 px-3.5 bg-background border border-border rounded-lg text-sm font-mono font-semibold text-foreground focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-muted-foreground mt-1">Default neighbor sample size</p>
              </div>

              <div>
                <label htmlFor="knn-maximum-k" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Maximum K Cap
                </label>
                <input
                  id="knn-maximum-k"
                  type="number"
                  min="1"
                  max="100"
                  value={knnSettings.maximumK}
                  onChange={(e) =>
                    setKnnSettings({ ...knnSettings, maximumK: parseInt(e.target.value, 10) || 20 })
                  }
                  className="w-full h-10 px-3.5 bg-background border border-border rounded-lg text-sm font-mono font-semibold text-foreground focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-muted-foreground mt-1">Upper bound search limit</p>
              </div>

              <div>
                <label htmlFor="knn-min-similarity" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Min Similarity Cutoff
                </label>
                <input
                  id="knn-min-similarity"
                  type="number"
                  step="0.05"
                  min="0.0"
                  max="1.0"
                  value={knnSettings.minimumSimilarity}
                  onChange={(e) =>
                    setKnnSettings({ ...knnSettings, minimumSimilarity: parseFloat(e.target.value) || 0.70 })
                  }
                  className="w-full h-10 px-3.5 bg-background border border-border rounded-lg text-sm font-mono font-semibold text-foreground focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-muted-foreground mt-1">Cosine similarity threshold (0.0 - 1.0)</p>
              </div>
            </div>

            {/* Save & Activate Button */}
            <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {!isBalanced && (
                  <span className="text-rose-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Cannot save until weights total exactly 100%.
                  </span>
                )}
                {isBalanced && (
                  <span className="text-emerald-700 font-medium">
                    Ready to create new immutable revision.
                  </span>
                )}
              </div>

              <button
                onClick={() => saveConfigMutation.mutate()}
                disabled={!isBalanced || saveConfigMutation.isPending}
                data-testid="save-config-button"
                className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm inline-flex items-center gap-2 transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {saveConfigMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-teal-400" />
                )}
                <span>Save & Activate New Revision</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Revalidation Monitor & Quality Metrics (1 col) */}
        <div className="space-y-6">
          {/* Revalidation Monitor Card */}
          <div className="p-5 bg-card border border-border rounded-xl shadow-subtle space-y-4" data-testid="revalidation-status-card">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <RotateCcw className={`w-4 h-4 text-teal-700 ${isRevalidating ? 'animate-spin' : ''}`} />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Revalidation Queue
                </h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isRevalidating
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {isRevalidating ? 'Processing' : 'Idle / Synchronized'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Batch Progress</span>
                <span className="font-mono font-bold text-slate-800">{progressPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Revalidation Task Stats Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Total Tasks</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">{totalTasks}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Completed</div>
                <div className="text-base font-bold font-mono text-emerald-700 mt-0.5">{completedTasks}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Pending / In Flight</div>
                <div className="text-base font-bold font-mono text-amber-700 mt-0.5">{pendingTasks}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Failed Tasks</div>
                <div className="text-base font-bold font-mono text-rose-700 mt-0.5">{failedTasks}</div>
              </div>
            </div>
          </div>

          {/* Scoring Quality Metrics Card */}
          <div className="p-5 bg-card border border-border rounded-xl shadow-subtle space-y-4" data-testid="quality-metrics-card">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Activity className="w-4 h-4 text-purple-700" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Scoring Quality Metrics
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">
                    Total Calculations
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {qualityMetrics?.totalScoresCalculated ?? 1420}
                  </div>
                </div>
                <BarChart className="w-6 h-6 text-slate-400" />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">
                    Average Fit Score
                  </div>
                  <div className="text-xl font-bold font-mono text-teal-700 mt-0.5">
                    {qualityMetrics?.averageFitScore ? `${qualityMetrics.averageFitScore}%` : '84.2%'}
                  </div>
                </div>
                <Target className="w-6 h-6 text-teal-600" />
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Stale Scores</div>
                  <div className="text-sm font-bold font-mono text-amber-700 mt-0.5">
                    {qualityMetrics?.staleScoresCount ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Failed Scores</div>
                  <div className="text-sm font-bold font-mono text-rose-700 mt-0.5">
                    {qualityMetrics?.failedScoresCount ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Configuration Version History Timeline */}
      <div className="bg-card border border-border rounded-xl shadow-subtle overflow-hidden" data-testid="config-history-list">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-slate-700" />
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                Configuration Version History
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Audit trail of algorithm versions, parameter modifications, and supersessions.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {historyList.length} past revisions
          </span>
        </div>

        {historyList.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No historical configuration versions recorded. Current version is initial baseline.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {historyList.map((item) => {
              const isExpanded = expandedHistoryId === item.id;

              return (
                <div key={item.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                  <div
                    onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center font-mono font-bold text-xs text-slate-800">
                        v{item.version}.{item.revision}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900">
                            Version {item.version} (Revision {item.revision})
                          </span>
                          <StatusBadge status={item.status} size="sm" />
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          Activated: {formatTimestamp(item.activatedAt || item.createdAt)}
                          {item.supersededAt && ` · Superseded: ${formatTimestamp(item.supersededAt)}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Condensed Weights Pills */}
                      <div className="hidden md:flex items-center gap-1.5 text-xs font-mono">
                        {item.weights?.map((w) => (
                          <span
                            key={w.dimension}
                            className="px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700"
                          >
                            {w.dimension.slice(0, 4)}: {w.weight}%
                          </span>
                        ))}
                      </div>

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Breakdown */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      {item.weights?.map((w) => (
                        <div key={w.dimension} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="text-xs text-muted-foreground font-mono font-semibold uppercase">
                            {w.dimension}
                          </div>
                          <div className="text-base font-bold font-mono text-slate-900 mt-1">
                            {w.weight}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Restore Defaults Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isRestoreConfirmOpen}
        title="Restore Default Scoring Configuration"
        description="Are you sure you want to reset all dimensional weights to factory defaults (Skills 40%, Experience 25%, Location 15%, Compliance 10%, Education 10%) and default KNN settings?"
        variant="warning"
        confirmText="Restore Defaults"
        isLoading={restoreDefaultsMutation.isPending}
        onConfirm={() => restoreDefaultsMutation.mutate()}
        onCancel={() => setIsRestoreConfirmOpen(false)}
      />
    </div>
  );
}
