import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  StatusBadge,
  ScoreBadge,
  PipelineIndicator,
  LoadingState,
  ErrorState,
  DocumentPreviewModal,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { formatDate, formatDateTime, getApplicationStatusMeta } from "../../lib/utils";
import {
  ApplicationStatus,
  InterviewType,
  PIPELINE_FILTER_STAGES,
  ALLOWED_STAGE_TRANSITIONS,
} from "../../lib/types/enums";
import type { Interview } from "../../lib/types/application.types";
import {
  User,
  Sparkles,
  FileText,
  Calendar,
  Building2,
  ShieldCheck,
  History,
  Truck,
  ArrowLeft,
  Clock,
  ExternalLink,
  Plus,
  UserCheck,
  UserX,
  CheckCircle2,
  AlertCircle,
  Eye,
  XCircle,
} from "lucide-react";



type TabKey =
  | "overview"
  | "ai-score"
  | "resume"
  | "interviews"
  | "endorsements"
  | "compliance"
  | "timeline"
  | "hiring";

export const ApplicationDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { applicationId } = useParams({ strict: false }) as { applicationId: string };

  const validTabs: TabKey[] = [
    "overview",
    "ai-score",
    "resume",
    "interviews",
    "endorsements",
    "compliance",
    "timeline",
    "hiring",
  ];

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== "undefined") {
      const paramTab = new URLSearchParams(window.location.search).get("tab") as TabKey;
      if (paramTab && validTabs.includes(paramTab)) {
        return paramTab;
      }
    }
    return "overview";
  });

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Modals state
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<ApplicationStatus>(ApplicationStatus.INITIAL_SCREENING);
  const [stageReason, setStageReason] = useState("");
  const [stageError, setStageError] = useState<string | null>(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("Qualifications Mismatch");
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectTargetStatus, setRejectTargetStatus] = useState<ApplicationStatus>(ApplicationStatus.ARCHIVED);

  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [interviewType, setInterviewType] = useState<InterviewType>(InterviewType.INITIAL_SCREENING);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");

  const [interviewOutcomeModalOpen, setInterviewOutcomeModalOpen] = useState(false);
  const [selectedInterviewForOutcome, setSelectedInterviewForOutcome] = useState<Interview | null>(null);
  const [interviewOutcomeResult, setInterviewOutcomeResult] = useState<"PASS" | "FAIL" | "NO_SHOW">("PASS");
  const [interviewOutcomeNotes, setInterviewOutcomeNotes] = useState("");

  const [endorseModalOpen, setEndorseModalOpen] = useState(false);
  const [endorseClientId, setEndorseClientId] = useState<number>(0);
  const [endorseOutcome, setEndorseOutcome] = useState<"PENDING" | "ENDORSED" | "DECLINED">("PENDING");
  const [endorseNotes, setEndorseNotes] = useState("");

  const [updateEndorsementModalOpen, setUpdateEndorsementModalOpen] = useState(false);
  const [selectedEndorsementId, setSelectedEndorsementId] = useState<number | null>(null);
  const [selectedEndorsementClientName, setSelectedEndorsementClientName] = useState("");
  const [updateEndorsementOutcome, setUpdateEndorsementOutcome] = useState<"PENDING" | "ENDORSED" | "DECLINED">("ENDORSED");
  const [updateEndorsementNotes, setUpdateEndorsementNotes] = useState("");

  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const [complianceDocLabel, setComplianceDocLabel] = useState("");
  const [complianceDeadline, setComplianceDeadline] = useState("");

  const [reviewReqId, setReviewReqId] = useState<number | null>(null);
  const [reviewReqStatus, setReviewReqStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewReqNotes, setReviewReqNotes] = useState("");

  const [previewDocState, setPreviewDocState] = useState<{
    open: boolean;
    documentId?: number | null;
    title?: string;
    requirementId?: number | null;
    requirementStatus?: string;
  } | null>(null);


  const [hireModalOpen, setHireModalOpen] = useState(false);
  const [hireEmployeeNumber, setHireEmployeeNumber] = useState("");
  const [hireDepartment, setHireDepartment] = useState("");
  const [hirePosition, setHirePosition] = useState("");

  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployClientId, setDeployClientId] = useState<number>(0);
  const [deploySite, setDeploySite] = useState("");

  // Queries
  const applicationQuery = useQuery({
    queryKey: ["ta", "application", applicationId],
    queryFn: () => taApi.getApplication(applicationId),
    enabled: Boolean(applicationId),
  });

  const decisionsQuery = useQuery({
    queryKey: ["ta", "application", applicationId, "decisions"],
    queryFn: () => taApi.getRecruiterDecisions(applicationId),
    enabled: Boolean(applicationId),
  });

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
  });

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: ApplicationStatus; reason?: string }) =>
      taApi.updateApplicationStatus(applicationId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      setStageModalOpen(false);
      setStageError(null);
      setFeedback({
        type: "success",
        message: `Candidate stage moved to ${getApplicationStatusMeta(vars.status).label}.`,
      });
    },
    onError: (err: any) => {
      const errMsg = err?.message || "Failed to update candidate pipeline stage.";
      setStageError(errMsg);
      setFeedback({
        type: "error",
        message: "Failed to advance stage: " + errMsg,
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (data: { status: ApplicationStatus; reason: string }) =>
      taApi.updateApplicationStatus(applicationId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId, "decisions"] });
      setRejectModalOpen(false);
      setRejectNotes("");
      setFeedback({
        type: "success",
        message: `Candidate has been moved to ${getApplicationStatusMeta(vars.status).label}.`,
      });
    },
    onError: (err: any) => {
      const errMsg = err?.message || "Failed to reject candidate.";
      setFeedback({
        type: "error",
        message: "Failed to reject candidate: " + errMsg,
      });
    },
  });

  const updateInterviewStatusMutation = useMutation({
    mutationFn: (data: { interviewId: number; result: "PASS" | "FAIL" | "NO_SHOW"; notes?: string; conductedAt?: string }) =>
      taApi.updateInterviewStatus(applicationId, data.interviewId, {
        result: data.result,
        notes: data.notes,
        conductedAt: data.conductedAt || new Date().toISOString(),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "compliance", "interviews"] });
      setInterviewOutcomeModalOpen(false);
      setSelectedInterviewForOutcome(null);
      setInterviewOutcomeNotes("");
      setStageError(null);
      setFeedback({
        type: "success",
        message: `Interview marked as ${vars.result}.`,
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Failed to update interview: " + (err.message || "An error occurred"),
      });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => taApi.analyzeApplication(applicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      setFeedback({ type: "success", message: "Candidate assessment and match score updated successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to refresh candidate assessment: " + err.message });
    },
  });

  const scheduleInterviewMutation = useMutation({
    mutationFn: (data: { type: InterviewType; scheduledAt: string; notes?: string }) =>
      taApi.scheduleInterview(applicationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      setInterviewModalOpen(false);
      setInterviewDate("");
      setInterviewNotes("");
      setFeedback({ type: "success", message: "Interview scheduled successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to schedule interview: " + err.message });
    },
  });

  const endorseMutation = useMutation({
    mutationFn: (data: { clientId: number; outcome: "PENDING" | "ENDORSED" | "DECLINED"; notes?: string }) =>
      taApi.recordEndorsement(applicationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId, "decisions"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setEndorseClientId(0);
      setEndorseOutcome("PENDING");
      setEndorseNotes("");
      setEndorseModalOpen(false);
      setFeedback({
        type: "success",
        message: "Client endorsement recorded successfully. Candidate pipeline stage updated to Client Endorsement.",
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Failed to record endorsement: " + (err?.response?.data?.message || err.message),
      });
    },
  });

  const updateEndorsementMutation = useMutation({
    mutationFn: (data: {
      endorsementId: number;
      outcome: "PENDING" | "ENDORSED" | "DECLINED";
      notes?: string;
    }) =>
      taApi.updateEndorsement(applicationId, data.endorsementId, {
        outcome: data.outcome,
        notes: data.notes,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId, "decisions"] });
      setUpdateEndorsementModalOpen(false);
      setSelectedEndorsementId(null);
      setUpdateEndorsementNotes("");
      setFeedback({
        type: "success",
        message: `Client endorsement decision updated to ${vars.outcome}.`,
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Failed to update client endorsement: " + (err?.message || "An error occurred"),
      });
    },
  });

  const addComplianceMutation = useMutation({
    mutationFn: (data: { documentLabel: string; deadline?: string; isRequired?: boolean }) =>
      taApi.createComplianceRequirement(applicationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      setComplianceModalOpen(false);
      setComplianceDocLabel("");
      setComplianceDeadline("");
      setFeedback({ type: "success", message: "Compliance requirement added." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to add compliance requirement: " + err.message });
    },
  });

  const reviewComplianceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { reviewStatus: "APPROVED" | "REJECTED"; reviewNotes?: string } }) =>
      taApi.reviewComplianceRequirement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      setReviewReqId(null);
      setReviewReqNotes("");
      setFeedback({ type: "success", message: "Compliance requirement review saved." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to review requirement: " + err.message });
    },
  });

  const hireMutation = useMutation({
    mutationFn: (data: { employeeNumber?: string; department?: string; position?: string }) =>
      taApi.completeHiring(applicationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      setHireModalOpen(false);
      setFeedback({ type: "success", message: "Candidate successfully hired! Digital 201 personnel record created." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to complete hiring: " + err.message });
    },
  });

  const deployMutation = useMutation({
    mutationFn: (data: { clientId: number; site?: string }) =>
      taApi.createDeployment(applicationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      setDeployModalOpen(false);
      setFeedback({ type: "success", message: "Deployment created and activated." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to create deployment: " + err.message });
    },
  });

  const appData = applicationQuery.data;
  const parsedAiAssessment = React.useMemo(() => {
    if (!appData?.aiSummary) return null;
    try {
      const parsed = typeof appData.aiSummary === "string" ? JSON.parse(appData.aiSummary) : appData.aiSummary;
      if (parsed && typeof parsed === "object") {
        return {
          summary: typeof parsed.summary === "string" ? parsed.summary : "",
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
        };
      }
    } catch {
      // Plain text fallback
    }
    return {
      summary: String(appData.aiSummary),
      strengths: [],
      gaps: [],
    };
  }, [appData?.aiSummary]);

  if (applicationQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Application Details" description="Loading application record..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (applicationQuery.isError || !applicationQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Application Details" description="Recruitment record" />
        <ErrorState error={applicationQuery.error} onRetry={() => applicationQuery.refetch()} />
      </div>
    );
  }

  const app = applicationQuery.data;
  const profile = app.user?.applicantProfile;
  const candidateName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : app.user?.email || "Candidate";
  const scores = app.candidateScores?.[0];
  const decisions = decisionsQuery.data || [];
  const clients = clientsQuery.data || [];

  // Stage transition prerequisite checks
  const hasPassedScreening = (app.interviews || []).some(
    (i) => i.type === "INITIAL_SCREENING" && (i.result === "PASS" || i.result === "PASSED") && i.isActive !== false
  );
  const pendingScreeningInterview = (app.interviews || []).find(
    (i) => i.type === "INITIAL_SCREENING" && (!i.result || i.result === "PENDING" || i.result === "SCHEDULED") && i.isActive !== false
  );

  const hasClientEndorsement = (app.clientEndorsements || []).some(
    (e) => e.outcome === "ENDORSED"
  );

  const hasPassedFinalInterview = (app.interviews || []).some(
    (i) => i.type === "FINAL_INTERVIEW" && (i.result === "PASS" || i.result === "PASSED") && i.isActive !== false
  );
  const pendingFinalInterview = (app.interviews || []).find(
    (i) => i.type === "FINAL_INTERVIEW" && (!i.result || i.result === "PENDING" || i.result === "SCHEDULED") && i.isActive !== false
  );

  const hasUnapprovedMandatoryCompliance = (app.complianceRequirements || []).some(
    (c) => c.isRequired && c.reviewStatus !== "APPROVED"
  );

  const isTerminal =
    app.status === ApplicationStatus.ARCHIVED ||
    app.status === ApplicationStatus.BACKOUT ||
    app.status === ApplicationStatus.DEPLOYED;
  const canAdvance = (ALLOWED_STAGE_TRANSITIONS[app.status] || []).length > 0;
  const canReject = !isTerminal;
  const canScheduleInterview = (
    [
      ApplicationStatus.REVIEW,
      ApplicationStatus.NEEDS_ATTENTION,
      ApplicationStatus.MATCHED,
      ApplicationStatus.TALENT_POOL,
      ApplicationStatus.INITIAL_SCREENING,
      ApplicationStatus.CLIENT_ENDORSEMENT,
      ApplicationStatus.FINAL_INTERVIEW,
    ] as ApplicationStatus[]
  ).includes(app.status);
  const canEndorse =
    hasPassedScreening &&
    (app.status === ApplicationStatus.INITIAL_SCREENING ||
      app.status === ApplicationStatus.CLIENT_ENDORSEMENT);

  const tabs: { id: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "overview", label: "Candidate Profile", icon: User },
    { id: "ai-score", label: "Candidate Assessment", icon: Sparkles },
    { id: "resume", label: "Resume & Documents", icon: FileText },
    { id: "interviews", label: `Interviews (${app.interviews?.length || 0})`, icon: Calendar },
    { id: "endorsements", label: `Endorsements (${app.clientEndorsements?.length || 0})`, icon: Building2 },
    { id: "compliance", label: `201 Compliance (${app.complianceRequirements?.length || 0})`, icon: ShieldCheck },
    { id: "timeline", label: `Decision Audit (${decisions.length})`, icon: History },
    { id: "hiring", label: "Hiring & Deployment", icon: Truck },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={candidateName}
        description={`Application Reference #${app.id} • Target Requisition: ${app.jobPosting?.title || "N/A"}`}
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Applications", href: "/ta/applications" },
          { label: candidateName },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/ta/applications">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Pipeline
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-teal-600" />}
              loading={analyzeMutation.isPending}
              onClick={() => analyzeMutation.mutate()}
            >
              Reassess Candidate
            </Button>
            {canReject && (
              <Button
                variant="outline"
                size="sm"
                className="text-rose-700 border-rose-300 hover:bg-rose-50"
                leftIcon={<UserX className="w-3.5 h-3.5 text-rose-600" />}
                onClick={() => {
                  setRejectReason("Qualifications Mismatch");
                  setRejectNotes("");
                  setRejectTargetStatus(ApplicationStatus.ARCHIVED);
                  setRejectModalOpen(true);
                }}
              >
                Reject Candidate
              </Button>
            )}
            {canAdvance && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const allowed = ALLOWED_STAGE_TRANSITIONS[app.status] || [];
                  setSelectedStage(allowed.length > 0 ? allowed[0] : app.status);
                  setStageError(null);
                  setStageModalOpen(true);
                }}
              >
                Advance Stage
              </Button>
            )}
          </div>
        }
      />

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Stage Progression & Highlights Banner */}
      <div className="bg-white border border-slate-300 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                Pipeline Status:
              </span>
              <StatusBadge status={app.status} size="sm" />
              <ScoreBadge score={scores?.finalFitScore ?? app.aiScore} size="md" />
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Submitted: {formatDate(app.createdAt)} • Email: {app.user?.email} • Phone: {profile?.mobileNumber || "N/A"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canScheduleInterview && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Calendar className="w-3.5 h-3.5" />}
                onClick={() => {
                  if (
                    hasPassedScreening &&
                    (app.status === ApplicationStatus.CLIENT_ENDORSEMENT ||
                      app.status === ApplicationStatus.FINAL_INTERVIEW)
                  ) {
                    setInterviewType(InterviewType.FINAL_INTERVIEW);
                  } else {
                    setInterviewType(InterviewType.INITIAL_SCREENING);
                  }
                  setInterviewModalOpen(true);
                }}
              >
                Schedule Interview
              </Button>
            )}
            {canEndorse && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Building2 className="w-3.5 h-3.5" />}
                onClick={() => setEndorseModalOpen(true)}
              >
                Client Endorse
              </Button>
            )}
          </div>
        </div>

        {/* Canonical Stepper */}
        <div className="py-1">
          <PipelineIndicator currentStatus={app.status} />
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="flex items-center border-b border-slate-300 overflow-x-auto bg-slate-100 divide-x divide-slate-300">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-white text-teal-950 font-bold border-b-2 border-b-teal-800 -mb-[1px]"
                    : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/60"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-teal-700" : "text-slate-400"
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6">
          {/* TAB 1: OVERVIEW & CANDIDATE PROFILE */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
                    Personal & Contact Demographics
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-mono">Full Name:</span>
                      <span className="col-span-2 font-semibold text-slate-900">{candidateName}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-mono">Contact Phone:</span>
                      <span className="col-span-2 text-slate-800 font-mono">{profile?.mobileNumber || "N/A"}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-mono">Current Address:</span>
                      <span className="col-span-2 text-slate-800">{profile?.address || "N/A"}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-mono">Region:</span>
                      <span className="col-span-2 text-slate-800">{profile?.city ? `${profile.city}, ${profile.province}` : "Philippines"}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-mono">Date of Birth:</span>
                      <span className="col-span-2 text-slate-800 font-mono">{profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Target Requisition Snapshot */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
                    Target Job Requisition
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-mono">Position Title:</span>
                      <span className="col-span-2 font-bold text-slate-900">{app.jobPosting?.title || "N/A"}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-mono">Location:</span>
                      <span className="col-span-2 text-slate-800">{app.jobPosting?.location || "Philippines"}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-mono">Status:</span>
                      <span className="col-span-2 font-mono">{app.jobPosting?.status || "OPEN"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Work Experience */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-mono font-bold uppercase text-slate-500">
                  Employment History
                </h4>
                {!profile?.workExperiences || profile.workExperiences.length === 0 ? (
                  <p className="text-xs text-slate-400">No recorded employment entries.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {profile.workExperiences.map((exp: any) => (
                      <div key={exp.id} className="py-2 text-xs">
                        <span className="font-bold text-slate-900">{exp.roleTitle}</span> at{" "}
                        <span className="font-medium text-slate-800">{exp.company}</span>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {formatDate(exp.startDate)} — {exp.isCurrent ? "Present" : exp.endDate ? formatDate(exp.endDate) : "N/A"}
                        </div>
                        {exp.summary && <p className="text-slate-600 mt-1">{exp.summary}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Education */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-mono font-bold uppercase text-slate-500">
                  Educational Attainment
                </h4>
                {!profile?.educations || profile.educations.length === 0 ? (
                  <p className="text-xs text-slate-400">No education entries on file.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {profile.educations.map((edu: any) => (
                      <div key={edu.id} className="py-2 text-xs">
                        <span className="font-bold text-slate-900">{edu.degree}</span> • {edu.school}
                        <div className="text-[11px] text-slate-400 font-mono">
                          {edu.fieldOfStudy}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Skills Tags */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-mono font-bold uppercase text-slate-500">
                  Competencies & Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {profile?.skills && profile.skills.length > 0 ? (
                    profile.skills.map((s: any, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-semibold border border-slate-200"
                      >
                        {typeof s === "string" ? s : s.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No skills listed</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI FIT ASSESSMENT & SCORE BREAKDOWN */}
          {activeTab === "ai-score" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Candidate Suitability & Match Score
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Calculated based on candidate qualifications, work experience, location, and job requirements
                  </p>
                </div>
                <ScoreBadge score={scores?.finalFitScore ?? app.aiScore} size="lg" />
              </div>

              {scores ? (
                <div className="border border-slate-300 bg-white grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-300">
                  <div className="p-3 text-center">
                    <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">Skills Match</div>
                    <div className="text-xl font-bold font-mono text-slate-950 tabular-nums mt-0.5">{Number(scores.skillsScore).toFixed(0)}%</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">Experience Fit</div>
                    <div className="text-xl font-bold font-mono text-slate-950 tabular-nums mt-0.5">{Number(scores.experienceScore).toFixed(0)}%</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">Location Proximity</div>
                    <div className="text-xl font-bold font-mono text-slate-950 tabular-nums mt-0.5">{Number(scores.locationScore).toFixed(0)}%</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">Compliance Match</div>
                    <div className="text-xl font-bold font-mono text-slate-950 tabular-nums mt-0.5">{Number(scores.complianceScore).toFixed(0)}%</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">Education / Certs</div>
                    <div className="text-xl font-bold font-mono text-slate-950 tabular-nums mt-0.5">{Number(scores.educationCertificationScore).toFixed(0)}%</div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-300 text-center text-xs font-mono text-slate-500">
                  Detailed criteria score breakdown is being calculated.
                </div>
              )}

              {/* Candidate Assessment & Recommendation */}
              {parsedAiAssessment && (
                <div className="border border-slate-300 bg-white shadow-xs">
                  <div className="px-4 py-3 bg-teal-50 border-b border-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-teal-800" />
                      <h4 className="text-xs font-bold font-mono text-teal-950 uppercase tracking-wide">
                        Candidate Assessment & Recommendation
                      </h4>
                    </div>
                    {app.aiScore !== null && app.aiScore !== undefined && (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-white text-teal-950 border border-slate-300">
                        Score: {app.aiScore}/100
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-4 text-xs">
                    {/* Executive Summary */}
                    {parsedAiAssessment.summary && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                          Executive Evaluation Summary
                        </div>
                        <p className="text-slate-900 leading-relaxed font-sans text-xs">
                          {parsedAiAssessment.summary}
                        </p>
                      </div>
                    )}

                    {/* Strengths & Gaps Breakdown */}
                    {(parsedAiAssessment.strengths.length > 0 || parsedAiAssessment.gaps.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                        {/* Key Strengths */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-teal-900 uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                            <span>Candidate Strengths ({parsedAiAssessment.strengths.length})</span>
                          </div>
                          {parsedAiAssessment.strengths.length > 0 ? (
                            <ul className="space-y-1.5">
                              {parsedAiAssessment.strengths.map((strength: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-slate-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
                                  <span className="leading-snug">{strength}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-slate-400 italic">No specific strengths documented</p>
                          )}
                        </div>

                        {/* Identified Gaps / Development Areas */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Identified Gaps & Considerations ({parsedAiAssessment.gaps.length})</span>
                          </div>
                          {parsedAiAssessment.gaps.length > 0 ? (
                            <ul className="space-y-1.5">
                              {parsedAiAssessment.gaps.map((gap: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-slate-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                  <span className="leading-snug">{gap}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-slate-400 italic">No critical gaps identified</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESUME & DOCUMENTS */}
          {activeTab === "resume" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Curriculum Vitae & Document Vault</h3>
                <p className="text-xs text-slate-500">
                  Candidate resumes and uploaded 201 verification files
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 uppercase">
                    <FileText className="w-4 h-4 text-teal-600" />
                    <span>Application Resume</span>
                  </div>
                  {app.resumeUrl || profile?.resumeUrl ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-600">CV Document on file</span>
                      <a
                        href={app.resumeUrl || profile?.resumeUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Resume (PDF)</span>
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No resume attached to this application.</p>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 uppercase">
                    <User className="w-4 h-4 text-teal-600" />
                    <span>Identification Photo</span>
                  </div>
                  {profile?.photoUrl ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={profile.photoUrl}
                          alt="Profile"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-300 shadow-xs"
                        />
                        <div>
                          <span className="text-xs text-slate-700 font-mono font-bold block">2x2 ID Photo</span>
                          <span className="text-[11px] text-slate-400 font-mono">Profile Avatar</span>
                        </div>
                      </div>
                      <a
                        href={profile.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Inspect Full Photo</span>
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No profile photo on file.</p>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: INTERVIEWS & SLA */}
          {activeTab === "interviews" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-900">Scheduled Interviews</h3>
                  <p className="text-xs text-slate-500">
                    Track candidate interviews, evaluate outcomes, and log recruiter feedback
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setInterviewModalOpen(true)}
                >
                  Schedule Interview
                </Button>
              </div>

              {!app.interviews || app.interviews.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No interviews scheduled yet. Click "Schedule Interview" to initiate candidate assessment.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {app.interviews.map((int) => {
                    const isPending = !int.result || int.result === "PENDING" || int.result === "SCHEDULED";
                    const isPassed = int.result === "PASS" || int.result === "PASSED";
                    const isFailed = int.result === "FAIL" || int.result === "FAILED";
                    const isNoShow = int.result === "NO_SHOW";

                    return (
                      <div key={int.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-slate-900 uppercase">
                              {int.type.replace(/_/g, " ")}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                isPassed
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : isFailed
                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                  : isNoShow
                                  ? "bg-slate-100 text-slate-800 border-slate-300"
                                  : "bg-blue-50 text-blue-800 border-blue-200"
                              }`}
                            >
                              {int.result || "SCHEDULED"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 font-mono flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Scheduled: {formatDateTime(int.scheduledAt || int.createdAt)}</span>
                          </div>
                          {int.conductedAt && (
                            <div className="text-xs text-slate-500 font-mono">
                              Conducted: {formatDateTime(int.conductedAt)}
                            </div>
                          )}
                          {int.notes && <p className="text-xs text-slate-600 mt-1">Notes: {int.notes}</p>}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isPending && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                              loading={updateInterviewStatusMutation.isPending}
                              onClick={() => {
                                updateInterviewStatusMutation.mutate({
                                  interviewId: int.id,
                                  result: "PASS",
                                  notes: int.notes || "Passed interview assessment",
                                });
                              }}
                            >
                              Mark as Passed
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedInterviewForOutcome(int);
                              setInterviewOutcomeResult(
                                isPassed ? "PASS" : isFailed ? "FAIL" : isNoShow ? "NO_SHOW" : "PASS"
                              );
                              setInterviewOutcomeNotes(int.notes || "");
                              setInterviewOutcomeModalOpen(true);
                            }}
                          >
                            {isPending ? "Record Result" : "Update Result"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CLIENT ENDORSEMENTS */}
          {activeTab === "endorsements" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-900">Client Endorsement Records</h3>
                  <p className="text-xs text-slate-500">
                    Candidate presentations to client hiring managers and endorsement decisions
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setEndorseModalOpen(true)}
                >
                  New Endorsement
                </Button>
              </div>

              {!app.clientEndorsements || app.clientEndorsements.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No endorsements recorded. Candidates must pass initial screening before client presentation.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {app.clientEndorsements.map((end) => (
                    <div key={end.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{end.client?.name || "Client"}</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            end.outcome === "ENDORSED" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" :
                            end.outcome === "DECLINED" ? "bg-rose-50 text-rose-800 border border-rose-200" :
                            "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}>
                            {end.outcome}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">Endorsed on {formatDate(end.createdAt)}</div>
                        {end.notes && <p className="text-xs text-slate-600 mt-1">{end.notes}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedEndorsementId(end.id);
                            setSelectedEndorsementClientName(end.client?.name || "Client");
                            setUpdateEndorsementOutcome(end.outcome as any);
                            setUpdateEndorsementNotes(end.notes || "");
                            setUpdateEndorsementModalOpen(true);
                          }}
                        >
                          Update Client Decision
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: 201 COMPLIANCE CHECKLIST */}
          {activeTab === "compliance" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-900">Pre-Employment 201 Compliance Checklist</h3>
                  <p className="text-xs text-slate-500">
                    Mandatory clearances (NBI, SSS, PhilHealth, Pag-IBIG, Medical) required before deployment
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setComplianceModalOpen(true)}
                >
                  Add Requirement
                </Button>
              </div>

              {!app.complianceRequirements || app.complianceRequirements.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No compliance requirements active on this application.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {app.complianceRequirements.map((req) => (
                    <div key={req.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{req.documentLabel}</span>
                          {req.isRequired && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">
                              MANDATORY
                            </span>
                          )}
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            req.reviewStatus === "APPROVED" ? "bg-emerald-50 text-emerald-800" :
                            req.reviewStatus === "REJECTED" ? "bg-rose-50 text-rose-800" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {req.reviewStatus}
                          </span>
                        </div>
                        {req.deadline && (
                          <div className="text-[11px] text-slate-400 font-mono">Deadline: {formatDate(req.deadline)}</div>
                        )}
                        {req.reviewNotes && <p className="text-xs text-slate-500 italic">Reviewer: {req.reviewNotes}</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        {req.documentId ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Eye className="w-3.5 h-3.5 text-slate-600" />}
                              onClick={() => {
                                setPreviewDocState({
                                  open: true,
                                  documentId: req.documentId,
                                  title: req.documentLabel,
                                  requirementId: req.id,
                                  requirementStatus: req.reviewStatus,
                                });
                              }}
                            >
                              View
                            </Button>
                            {req.reviewStatus !== "APPROVED" && (
                              <Button
                                variant="primary"
                                size="sm"
                                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                loading={reviewComplianceMutation.isPending && reviewReqId === req.id && reviewReqStatus === "APPROVED"}
                                onClick={() => {
                                  setReviewReqId(req.id);
                                  setReviewReqStatus("APPROVED");
                                  reviewComplianceMutation.mutate({
                                    id: req.id,
                                    data: { reviewStatus: "APPROVED" },
                                  });
                                }}
                              >
                                Approve
                              </Button>
                            )}
                            {req.reviewStatus !== "REJECTED" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-rose-300 text-rose-700 hover:bg-rose-50"
                                leftIcon={<XCircle className="w-3.5 h-3.5 text-rose-600" />}
                                onClick={() => {
                                  setReviewReqId(req.id);
                                  setReviewReqStatus("REJECTED");
                                  setReviewReqNotes(req.reviewNotes || "");
                                }}
                              >
                                Reject
                              </Button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              Missing
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReviewReqId(req.id);
                                setReviewReqStatus(req.reviewStatus === "REJECTED" ? "REJECTED" : "APPROVED");
                                setReviewReqNotes(req.reviewNotes || "");
                              }}
                            >
                              Manual Review
                            </Button>
                          </div>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: RECRUITER DECISION TIMELINE */}
          {activeTab === "timeline" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Immutable Recruiter Decision Log</h3>
                <p className="text-xs text-slate-500">
                  Audit trail of pipeline transitions and administrative actions
                </p>
              </div>

              {decisions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No manual recruiter decisions recorded yet. Initial submission created by applicant.
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                  {decisions.map((dec) => (
                    <div key={dec.id} className="flex items-start gap-4 relative">
                      <div className="w-7 h-7 rounded-full bg-teal-50 border-2 border-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                        <History className="w-3.5 h-3.5 text-teal-700" />
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex-1 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {dec.fromStatus} → {dec.toStatus}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatDateTime(dec.createdAt)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Action by: {dec.actor?.email || dec.actorId}
                        </div>
                        {dec.reason && (
                          <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                            Rationale: "{dec.reason}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: HIRING & DEPLOYMENT */}
          {activeTab === "hiring" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Post-Hire Onboarding & Field Deployment</h3>
                <p className="text-xs text-slate-500">
                  Generate digital 201 personnel records and create active site deployment assignments
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 uppercase">
                    <UserCheck className="w-4 h-4 text-teal-600" />
                    <span>Complete Hiring (Generate 201 Record)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Once the candidate passes final interview and meets pre-employment requirements, click below to transition candidate into employee status.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={Boolean(app.hiredEmployee) || !hasPassedFinalInterview}
                    onClick={() => {
                      setHirePosition(app.jobPosting?.title || "");
                      setHireDepartment(app.jobPosting?.location || "Operations");
                      setHireModalOpen(true);
                    }}
                  >
                    {app.hiredEmployee ? "Candidate Already Hired" : "Complete Hiring Workflow"}
                  </Button>
                  {!hasPassedFinalInterview && !app.hiredEmployee && (
                    <p className="text-[11px] font-mono text-amber-700 mt-1">
                      ⚠️ Candidate must complete and PASS Final Interview before hiring.
                    </p>
                  )}
                  {app.hiredEmployee && (
                    <p className="text-[11px] font-mono text-teal-700 mt-1">
                      ✅ Digital 201 Record Active ({app.hiredEmployee.employeeNumber}).
                    </p>
                  )}
                </div>

                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 uppercase">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>Assign Deployment Site</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Deploy candidate to client location under an active Manpower Request (MRF).
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      !app.hiredEmployee ||
                      hasUnapprovedMandatoryCompliance ||
                      app.status === ApplicationStatus.DEPLOYED
                    }
                    onClick={() => {
                      const approvedEndorsement = app.clientEndorsements?.find((e) => e.outcome === "ENDORSED");
                      if (approvedEndorsement?.clientId) {
                        setDeployClientId(approvedEndorsement.clientId);
                      }
                      setDeploySite(app.jobPosting?.location || "");
                      setDeployModalOpen(true);
                    }}
                  >
                    {app.status === ApplicationStatus.DEPLOYED
                      ? "Currently Deployed"
                      : "Deploy to Client Site"}
                  </Button>
                  {!app.hiredEmployee && (
                    <p className="text-[11px] font-mono text-slate-500 mt-1">
                      ℹ️ Complete hiring workflow first to create employee record.
                    </p>
                  )}
                  {app.hiredEmployee && hasUnapprovedMandatoryCompliance && (
                    <p className="text-[11px] font-mono text-amber-700 mt-1">
                      ⚠️ All mandatory 201 compliance clearances must be APPROVED before deployment.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stage Advance Modal */}
      <Dialog
        open={stageModalOpen}
        onClose={() => setStageModalOpen(false)}
        title="Advance Candidate Pipeline Stage"
        description={`Transition ${candidateName} to next hiring milestone`}
      >
        <div className="space-y-4">
          {(ALLOWED_STAGE_TRANSITIONS[app.status]?.length ?? 0) === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono">
              Candidate is in a terminal status ({app.status}). No further stage transitions are permitted.
            </div>
          ) : (
            <Select
              label="New Recruitment Stage"
              value={selectedStage}
              onChange={(e) => {
                setSelectedStage(e.target.value as ApplicationStatus);
                setStageError(null);
              }}
              options={(ALLOWED_STAGE_TRANSITIONS[app.status] || PIPELINE_FILTER_STAGES).map((s) => ({
                value: s,
                label: getApplicationStatusMeta(s).label,
              }))}
            />
          )}

          {/* Stage Prerequisite Guidance */}
          {selectedStage === ApplicationStatus.HIRED && !hasPassedFinalInterview && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded space-y-2">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Final Interview Prerequisite Required</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Advancing to <strong>Hired</strong> requires a passed Final Interview record in the system.
                {pendingFinalInterview
                  ? " The scheduled Final Interview is currently Pending."
                  : " No Final Interview has been scheduled or passed yet."}
              </p>
              {pendingFinalInterview && (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                  loading={updateInterviewStatusMutation.isPending}
                  onClick={() => {
                    updateInterviewStatusMutation.mutate({
                      interviewId: pendingFinalInterview.id,
                      result: "PASS",
                      notes: stageReason || "Passed final interview assessment",
                    });
                  }}
                >
                  Mark Final Interview as Passed
                </Button>
              )}
            </div>
          )}

          {selectedStage === ApplicationStatus.HIRED && hasPassedFinalInterview && (
            <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 text-xs rounded space-y-2">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Digital 201 Personnel Record Provisioning</span>
              </div>
              <p className="text-teal-800 leading-relaxed">
                Advancing to <strong>Hired</strong> will generate the candidate's Digital 201 Employee Record in Personnel. You can also specify custom employee numbers, department, and designation.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-teal-300 text-teal-900 hover:bg-teal-100"
                onClick={() => {
                  setStageModalOpen(false);
                  setHireModalOpen(true);
                }}
              >
                Open Detailed 201 Hiring Form
              </Button>
            </div>
          )}

          {selectedStage === ApplicationStatus.CLIENT_ENDORSEMENT && !hasPassedScreening && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded space-y-2">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Screening Prerequisite Required</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Advancing to <strong>Client Endorsement</strong> requires a passed Initial Screening interview.
                {pendingScreeningInterview
                  ? " The Initial Screening interview is currently Pending."
                  : " No Initial Screening interview has been recorded yet."}
              </p>
              {pendingScreeningInterview && (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                  loading={updateInterviewStatusMutation.isPending}
                  onClick={() => {
                    updateInterviewStatusMutation.mutate({
                      interviewId: pendingScreeningInterview.id,
                      result: "PASS",
                      notes: stageReason || "Passed initial screening interview",
                    });
                  }}
                >
                  Mark Screening as Passed
                </Button>
              )}
            </div>
          )}

          {selectedStage === ApplicationStatus.FINAL_INTERVIEW && !hasClientEndorsement && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Client Endorsement Required</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Advancing to <strong>Final Interview</strong> requires an endorsed client presentation (Outcome: <strong>ENDORSED</strong>). Please record a client endorsement first.
              </p>
            </div>
          )}

          {selectedStage === ApplicationStatus.DEPLOYED && hasUnapprovedMandatoryCompliance && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Compliance Prerequisite Required</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Deployment requires all mandatory pre-employment compliance documents to be uploaded and <strong>APPROVED</strong>.
              </p>
            </div>
          )}

          {selectedStage === ApplicationStatus.DEPLOYED && !hasUnapprovedMandatoryCompliance && (
            <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 text-xs rounded space-y-2">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Workforce Site Deployment Setup</span>
              </div>
              <p className="text-teal-800 leading-relaxed">
                Advancing to <strong>Deployed</strong> will activate site deployment. You can also specify client account, site location, and contract duration.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-teal-300 text-teal-900 hover:bg-teal-100"
                onClick={() => {
                  setStageModalOpen(false);
                  setDeployModalOpen(true);
                }}
              >
                Open Site Deployment Form
              </Button>
            </div>
          )}

          {stageError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono rounded flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold">Stage Transition Error</div>
                <div>{stageError}</div>
              </div>
            </div>
          )}

          <Textarea
            label="Recruiter Decision Rationale"
            placeholder="Document interview feedback or assessment justification"
            value={stageReason}
            onChange={(e) => setStageReason(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setStageModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={updateStatusMutation.isPending}
              onClick={() =>
                updateStatusMutation.mutate({
                  status: selectedStage,
                  reason: stageReason || undefined,
                })
              }
            >
              Confirm Transition
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Record Interview Result Modal */}
      <Dialog
        open={interviewOutcomeModalOpen}
        onClose={() => setInterviewOutcomeModalOpen(false)}
        title="Record Interview Assessment"
        description={`Record outcome for ${selectedInterviewForOutcome?.type?.replace(/_/g, " ") || "Interview"}`}
      >
        <div className="space-y-4">
          <Select
            label="Interview Outcome / Result"
            value={interviewOutcomeResult}
            onChange={(e) => setInterviewOutcomeResult(e.target.value as "PASS" | "FAIL" | "NO_SHOW")}
            options={[
              { value: "PASS", label: "PASS — Candidate Meets Technical & Behavioral Requirements" },
              { value: "FAIL", label: "FAIL — Candidate Does Not Qualify" },
              { value: "NO_SHOW", label: "NO SHOW — Candidate Did Not Attend (Auto-archive)" },
            ]}
          />
          <Textarea
            label="Evaluation Notes & Interviewer Remarks"
            placeholder="Document technical competencies, communication skills, or panel remarks"
            value={interviewOutcomeNotes}
            onChange={(e) => setInterviewOutcomeNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setInterviewOutcomeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={updateInterviewStatusMutation.isPending}
              onClick={() => {
                if (selectedInterviewForOutcome) {
                  updateInterviewStatusMutation.mutate({
                    interviewId: selectedInterviewForOutcome.id,
                    result: interviewOutcomeResult,
                    notes: interviewOutcomeNotes,
                  });
                }
              }}
            >
              Save Result
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Schedule Interview Modal */}
      <Dialog
        open={interviewModalOpen}
        onClose={() => setInterviewModalOpen(false)}
        title="Schedule Candidate Interview"
        description="Book initial screening or final technical assessment"
      >
        <div className="space-y-4">
          <Select
            label="Interview Type"
            value={interviewType}
            onChange={(e) => setInterviewType(e.target.value as InterviewType)}
            options={[
              { value: InterviewType.INITIAL_SCREENING, label: "Initial Screening Interview" },
              { value: InterviewType.FINAL_INTERVIEW, label: "Final Technical / Client Interview" },
            ]}
          />
          <Input
            label="Scheduled Date & Time"
            type="datetime-local"
            value={interviewDate}
            onChange={(e) => setInterviewDate(e.target.value)}
            required
          />
          <Textarea
            label="Coordinator Notes / Meeting Link"
            placeholder="e.g. Google Meet link or room number"
            value={interviewNotes}
            onChange={(e) => setInterviewNotes(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setInterviewModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!interviewDate}
              loading={scheduleInterviewMutation.isPending}
              onClick={() =>
                scheduleInterviewMutation.mutate({
                  type: interviewType,
                  scheduledAt: new Date(interviewDate).toISOString(),
                  notes: interviewNotes || undefined,
                })
              }
            >
              Schedule Interview
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Client Endorse Modal */}
      <Dialog
        open={endorseModalOpen}
        onClose={() => setEndorseModalOpen(false)}
        title="Record Client Endorsement"
        description="Submit candidate for client review and endorsement decision"
      >
        <div className="space-y-4">
          <Select
            label="Target Client"
            value={endorseClientId}
            onChange={(e) => setEndorseClientId(Number(e.target.value))}
            options={[
              { value: 0, label: "Select a client..." },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            label="Endorsement Outcome"
            value={endorseOutcome}
            onChange={(e) => setEndorseOutcome(e.target.value as any)}
            options={[
              { value: "PENDING", label: "PENDING (Under Client Review)" },
              { value: "ENDORSED", label: "ENDORSED (Approved by Client)" },
              { value: "DECLINED", label: "DECLINED (Client Rejected)" },
            ]}
          />
          <Textarea
            label="Endorsement Notes"
            placeholder="Client coordinator feedback..."
            value={endorseNotes}
            onChange={(e) => setEndorseNotes(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setEndorseModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!endorseClientId}
              loading={endorseMutation.isPending}
              onClick={() =>
                endorseMutation.mutate({
                  clientId: endorseClientId,
                  outcome: endorseOutcome,
                  notes: endorseNotes || undefined,
                })
              }
            >
              Record Endorsement
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Update Client Decision Modal */}
      <Dialog
        open={updateEndorsementModalOpen}
        onClose={() => setUpdateEndorsementModalOpen(false)}
        title="Update Client Endorsement Decision"
        description={`Record client hiring manager decision for ${selectedEndorsementClientName}`}
      >
        <div className="space-y-4">
          <Select
            label="Client Decision Outcome"
            value={updateEndorsementOutcome}
            onChange={(e) => setUpdateEndorsementOutcome(e.target.value as any)}
            options={[
              { value: "PENDING", label: "PENDING (Under Review)" },
              { value: "ENDORSED", label: "APPROVED / ENDORSED (Client Accepted for Final Stage)" },
              { value: "DECLINED", label: "REJECTED / DECLINED (Client Passed on Candidate)" },
            ]}
          />
          <Textarea
            label="Client Feedback / Evaluation Notes"
            placeholder="Feedback from client hiring manager regarding qualifications, fit, or interview availability..."
            value={updateEndorsementNotes}
            onChange={(e) => setUpdateEndorsementNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setUpdateEndorsementModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={updateEndorsementOutcome === "DECLINED" ? "danger" : "primary"}
              size="sm"
              loading={updateEndorsementMutation.isPending}
              onClick={() => {
                if (selectedEndorsementId) {
                  updateEndorsementMutation.mutate({
                    endorsementId: selectedEndorsementId,
                    outcome: updateEndorsementOutcome,
                    notes: updateEndorsementNotes || undefined,
                  });
                }
              }}
            >
              Save Decision
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add Compliance Modal */}
      <Dialog
        open={complianceModalOpen}
        onClose={() => setComplianceModalOpen(false)}
        title="Add Pre-Employment 201 Requirement"
        description="Assign required clearance document for candidate submission"
      >
        <div className="space-y-4">
          <Input
            label="Document Label / Clearance Type"
            placeholder="e.g. NBI Clearance, SSS Static Form, Medical Fit to Work"
            value={complianceDocLabel}
            onChange={(e) => setComplianceDocLabel(e.target.value)}
            required
          />
          <Input
            label="Submission Deadline (Optional)"
            type="date"
            value={complianceDeadline}
            onChange={(e) => setComplianceDeadline(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setComplianceModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!complianceDocLabel.trim()}
              loading={addComplianceMutation.isPending}
              onClick={() =>
                addComplianceMutation.mutate({
                  documentLabel: complianceDocLabel,
                  deadline: complianceDeadline ? new Date(complianceDeadline).toISOString() : undefined,
                  isRequired: true,
                })
              }
            >
              Add Requirement
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Review Compliance Modal */}
      <Dialog
        open={Boolean(reviewReqId)}
        onClose={() => setReviewReqId(null)}
        title="Review Compliance Document"
        description="Verify candidate submission and set approval state"
      >
        <div className="space-y-4">
          {(() => {
            const selectedReq = app.complianceRequirements?.find((r) => r.id === reviewReqId);
            return (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Requirement: {selectedReq?.documentLabel}</span>
                  <span className="font-mono text-[10px] uppercase text-slate-600">{selectedReq?.reviewStatus}</span>
                </div>
                {selectedReq?.documentId ? (
                  <div className="pt-1">
                    <a
                      href={`/api/documents/${selectedReq.documentId}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-blue-600 hover:text-blue-800 underline font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open / Inspect Uploaded Document
                    </a>
                  </div>
                ) : (
                  <div className="text-amber-700 text-[11px] font-mono">
                    No document has been uploaded by candidate yet.
                  </div>
                )}
              </div>
            );
          })()}

          <Select
            label="Verification Decision"
            value={reviewReqStatus}
            onChange={(e) => setReviewReqStatus(e.target.value as any)}
            options={[
              { value: "APPROVED", label: "APPROVE (Clearance Verified)" },
              { value: "REJECTED", label: "REJECT (Unclear / Invalid Document)" },
            ]}
          />
          <Textarea
            label="Reviewer Notes / Feedback to Candidate"
            placeholder="e.g. Clearance verified authentic with no derogatory records OR specify reason for rejection..."
            value={reviewReqNotes}
            onChange={(e) => setReviewReqNotes(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setReviewReqId(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewReqStatus === "APPROVED" ? "primary" : "danger"}
              size="sm"
              loading={reviewComplianceMutation.isPending}
              onClick={() => {
                if (reviewReqId) {
                  reviewComplianceMutation.mutate({
                    id: reviewReqId,
                    data: {
                      reviewStatus: reviewReqStatus,
                      reviewNotes: reviewReqNotes || undefined,
                    },
                  });
                }
              }}
            >
              Confirm Review
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Document Preview & Verification Modal */}
      <DocumentPreviewModal
        open={Boolean(previewDocState?.open)}
        onClose={() => setPreviewDocState(null)}
        documentId={previewDocState?.documentId}
        title={previewDocState?.title || "Compliance Document"}
        applicantName={candidateName}
        requirementStatus={previewDocState?.requirementStatus}
        onApprove={() => {
          if (previewDocState?.requirementId) {
            reviewComplianceMutation.mutate({
              id: previewDocState.requirementId,
              data: { reviewStatus: "APPROVED" },
            });
            setPreviewDocState(null);
          }
        }}
        onReject={(notes) => {
          if (previewDocState?.requirementId) {
            reviewComplianceMutation.mutate({
              id: previewDocState.requirementId,
              data: { reviewStatus: "REJECTED", reviewNotes: notes },
            });
            setPreviewDocState(null);
          }
        }}
        isActionLoading={reviewComplianceMutation.isPending}
      />

      {/* Complete Hire Modal */}
      <Dialog
        open={hireModalOpen}

        onClose={() => setHireModalOpen(false)}
        title="Complete Hiring & Onboarding"
        description="Convert candidate into active employee and create Digital 201 file"
      >
        <div className="space-y-4">
          <Input
            label="Employee Identification Number"
            placeholder="e.g. EMP-2026-0042"
            value={hireEmployeeNumber}
            onChange={(e) => setHireEmployeeNumber(e.target.value)}
          />
          <Input
            label="Assigned Department"
            placeholder="e.g. Operations / Logistics"
            value={hireDepartment}
            onChange={(e) => setHireDepartment(e.target.value)}
          />
          <Input
            label="Designation / Position"
            placeholder="e.g. Warehouse Inventory Supervisor"
            value={hirePosition}
            onChange={(e) => setHirePosition(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setHireModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={hireMutation.isPending}
              onClick={() =>
                hireMutation.mutate({
                  employeeNumber: hireEmployeeNumber || undefined,
                  department: hireDepartment || undefined,
                  position: hirePosition || undefined,
                })
              }
            >
              Complete Hiring
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Deploy Modal */}
      <Dialog
        open={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        title="Create Site Deployment"
        description="Deploy hired employee to client location"
      >
        <div className="space-y-4">
          <Select
            label="Client Account"
            value={deployClientId}
            onChange={(e) => setDeployClientId(Number(e.target.value))}
            options={[
              { value: 0, label: "Select client..." },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Input
            label="Deployment Site / Location"
            placeholder="e.g. Calamba Facility Plant 2"
            value={deploySite}
            onChange={(e) => setDeploySite(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setDeployModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!deployClientId}
              loading={deployMutation.isPending}
              onClick={() =>
                deployMutation.mutate({
                  clientId: deployClientId,
                  site: deploySite || undefined,
                })
              }
            >
              Activate Deployment
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Reject Candidate Modal */}
      <Dialog
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Candidate / Archive Application"
        description={`Record formal decision and reason for removing ${candidateName} from active pipeline`}
      >
        <div className="space-y-4">
          <Select
            label="Rejection Reason Category"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            options={[
              { value: "Qualifications Mismatch", label: "Qualifications / Skills Mismatch" },
              { value: "Failed Screening Interview", label: "Failed Initial Screening Interview" },
              { value: "Client Declined Endorsement", label: "Client Declined / Rejected Endorsement" },
              { value: "Failed Final Interview", label: "Failed Final Technical / Client Interview" },
              { value: "Candidate Withdrew / Backout", label: "Candidate Withdrew Application / Backout" },
              { value: "Salary Expectation Unmet", label: "Salary / Compensation Expectation Mismatch" },
              { value: "Failed Compliance Verification", label: "Failed 201 Compliance / Derogatory Record" },
              { value: "Other / Discretionary", label: "Other Discretionary Reason" },
            ]}
          />
          <Select
            label="Target Disposition Status"
            value={rejectTargetStatus}
            onChange={(e) => setRejectTargetStatus(e.target.value as ApplicationStatus)}
            options={[
              { value: ApplicationStatus.ARCHIVED, label: "Archive Application (ARCHIVED)" },
              { value: ApplicationStatus.TALENT_POOL, label: "Retain in Talent Pool for Future Roles (TALENT_POOL)" },
            ]}
          />
          <Textarea
            label="Decision Notes / Remarks"
            placeholder="Detailed notes explaining the rejection rationale..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={rejectMutation.isPending}
              onClick={() =>
                rejectMutation.mutate({
                  status: rejectTargetStatus,
                  reason: rejectNotes.trim() ? `${rejectReason}: ${rejectNotes.trim()}` : rejectReason,
                })
              }
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
