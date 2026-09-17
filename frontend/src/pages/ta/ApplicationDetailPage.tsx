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
import { OnboardingDeploymentStepper } from "../../components/ta/OnboardingDeploymentStepper";
import { InlineResumeViewer } from "../../components/ta/InlineResumeViewer";
import { Button, Dialog, Input, Select, Textarea, ComboBox } from "../../components/ui";
import { formatDate, formatDateTime, getApplicationStatusMeta, extractDocumentId } from "../../lib/utils";
import { COMPLIANCE_201_PRESETS } from "../../lib/hr-constants";
import {
  ApplicationStatus,
  InterviewType,
} from "../../lib/types/enums";
import type { Interview } from "../../lib/types/application.types";
import {
  UserCheck,
  Award,
  RefreshCw,
  Users,
  Calendar,
  Building2,
  ShieldCheck,
  History,
  Truck,
  ArrowLeft,
  Clock,
  ExternalLink,
  Plus,
  UserX,
  CheckCircle2,
  AlertCircle,
  Eye,
  XCircle,
  FileCheck,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { notify } from "../../lib/feedback";

type TabKey = "evaluation" | "compliance" | "history";

const normalizeTab = (tab: string | null): TabKey => {
  if (!tab) return "evaluation";
  switch (tab) {
    case "evaluation":
    case "overview":
    case "ai-score":
    case "interviews":
    case "similar":
      return "evaluation";
    case "compliance":
    case "endorsements":
    case "hiring":
      return "compliance";
    case "history":
    case "timeline":
    case "decisions":
    case "audit":
    case "activity":
      return "history";
    default:
      return "evaluation";
  }
};

export const ApplicationDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { applicationId } = useParams({ strict: false }) as { applicationId: string };

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== "undefined") {
      const paramTab = new URLSearchParams(window.location.search).get("tab");
      return normalizeTab(paramTab);
    }
    return "evaluation";
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
  const [manualClientId, setManualClientId] = useState<number | null>(null);
  const [endorseOutcome, setEndorseOutcome] = useState<"PENDING" | "APPROVED" | "DECLINED" | "ENDORSED">("PENDING");
  const [endorseNotes, setEndorseNotes] = useState("");

  const [updateEndorsementModalOpen, setUpdateEndorsementModalOpen] = useState(false);
  const [selectedEndorsementId, setSelectedEndorsementId] = useState<number | null>(null);
  const [selectedEndorsementClientName, setSelectedEndorsementClientName] = useState("");
  const [updateEndorsementOutcome, setUpdateEndorsementOutcome] = useState<"PENDING" | "APPROVED" | "DECLINED" | "ENDORSED">("APPROVED");
  const [updateEndorsementNotes, setUpdateEndorsementNotes] = useState("");

  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const [complianceDocLabel, setComplianceDocLabel] = useState("");
  const [complianceDeadline, setComplianceDeadline] = useState("");

  const [editDeadlineModalOpen, setEditDeadlineModalOpen] = useState(false);
  const [editDeadlineReqId, setEditDeadlineReqId] = useState<number | null>(null);
  const [editDeadlineDate, setEditDeadlineDate] = useState("");

  const [reviewReqId, setReviewReqId] = useState<number | null>(null);
  const [reviewReqStatus, setReviewReqStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewReqNotes, setReviewReqNotes] = useState("");

  const [previewDocState, setPreviewDocState] = useState<{
    open: boolean;
    documentId?: number | null;
    fileUrl?: string | null;
    title?: string;
    requirementId?: number | null;
    requirementStatus?: string;
  } | null>(null);

  const [photoImgError, setPhotoImgError] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(`megs_ta_resume_open_${applicationId}`);
      if (stored !== null) {
        return stored === "true";
      }
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const toggleResume = (open: boolean) => {
    setIsResumeOpen(open);
    if (typeof window !== "undefined" && applicationId) {
      sessionStorage.setItem(`megs_ta_resume_open_${applicationId}`, String(open));
    }
  };

  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployClientId, setDeployClientId] = useState<number>(0);
  const [deploySite, setDeploySite] = useState("");
  const [deployContractStart, setDeployContractStart] = useState("");
  const [deployContractEnd, setDeployContractEnd] = useState("");
  const [deployNotes, setDeployNotes] = useState("");

  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractNotes, setContractNotes] = useState("");
  const [contractDocumentUrl, setContractDocumentUrl] = useState("");

  const [orientationModalOpen, setOrientationModalOpen] = useState(false);
  const [orientationDate, setOrientationDate] = useState("");
  const [orientationNotes, setOrientationNotes] = useState("");
  const [isEducationExpanded, setIsEducationExpanded] = useState(true);
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(false);
  const [manualRequirementsToggle, setManualRequirementsToggle] = useState<boolean | null>(null);
  const [endorsementsExpanded, setEndorsementsExpanded] = useState(false);
  const [isInterviewHistoryExpanded, setIsInterviewHistoryExpanded] = useState(false);

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
    staleTime: 5 * 60 * 1000,
  });

  const [similarTalentOpen, setSimilarTalentOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("tab") === "similar";
    }
    return false;
  });

  const similarCandidatesQuery = useQuery({
    queryKey: ["ta", "application", applicationId, "similar"],
    queryFn: () => taApi.getSimilarCandidates(applicationId),
    enabled: activeTab === "evaluation" && similarTalentOpen && Boolean(applicationId),
  });

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: ApplicationStatus; reason?: string }) =>
      taApi.updateApplicationStatus(applicationId, data),
    onSuccess: (_, vars) => {
      queryClient.setQueryData<any>(["ta", "application", applicationId], (old: any) =>
        old ? { ...old, status: vars.status } : old
      );
      queryClient.setQueriesData<any>({ queryKey: ["ta", "applications"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((item) => (String(item.id) === String(applicationId) ? { ...item, status: vars.status } : item));
        }
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((item: any) => (String(item.id) === String(applicationId) ? { ...item, status: vars.status } : item)),
          };
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      const msg = `Candidate stage moved to ${getApplicationStatusMeta(vars.status).label}.`;
      setFeedback({
        type: "success",
        message: msg,
      });
      notify.success("Pipeline Stage Updated", msg);
    },
    onError: (err: any) => {
      const errMsg = err?.message || "Failed to update candidate pipeline stage.";
      setFeedback({
        type: "error",
        message: "Failed to advance stage: " + errMsg,
      });
      notify.error("Stage Update Failed", err);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (data: { status: ApplicationStatus; reason: string }) =>
      taApi.updateApplicationStatus(applicationId, data),
    onSuccess: (_, vars) => {
      queryClient.setQueryData<any>(["ta", "application", applicationId], (old: any) =>
        old
          ? {
              ...old,
              status: vars.status,
              isArchived: vars.status === ApplicationStatus.ARCHIVED ? true : old.isArchived,
            }
          : old
      );
      queryClient.setQueriesData<any>({ queryKey: ["ta", "applications"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((item) =>
            String(item.id) === String(applicationId)
              ? { ...item, status: vars.status, isArchived: vars.status === ApplicationStatus.ARCHIVED ? true : item.isArchived }
              : item
          );
        }
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((item: any) =>
              String(item.id) === String(applicationId)
                ? { ...item, status: vars.status, isArchived: vars.status === ApplicationStatus.ARCHIVED ? true : item.isArchived }
                : item
            ),
          };
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId, "decisions"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      setRejectModalOpen(false);
      setRejectNotes("");
      const msg = `Candidate has been moved to ${getApplicationStatusMeta(vars.status).label}.`;
      setFeedback({
        type: "success",
        message: msg,
      });
      notify.success("Candidate Status Updated", msg);
    },
    onError: (err: any) => {
      const errMsg = err?.message || "Failed to reject candidate.";
      setFeedback({
        type: "error",
        message: "Failed to reject candidate: " + errMsg,
      });
      notify.error("Status Update Failed", err);
    },
  });

  const signContractMutation = useMutation({
    mutationFn: (data: { contractNotes?: string; contractDocumentUrl?: string }) =>
      taApi.signContract(applicationId, data),
    onSuccess: (updatedApp: any, vars) => {
      queryClient.setQueryData<any>(["ta", "application", applicationId], (old: any) =>
        old
          ? {
              ...old,
              contractSigned: true,
              contractNotes: vars.contractNotes || old.contractNotes,
              contractDocumentUrl: vars.contractDocumentUrl || old.contractDocumentUrl,
              ...(updatedApp?.status ? { status: updatedApp.status } : {}),
            }
          : old
      );
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId, "decisions"] });
      setContractModalOpen(false);
      setFeedback({
        type: "success",
        message: "Employment contract successfully recorded as signed.",
      });
      notify.success("Contract Signed", "Employment contract recorded successfully.");
    },
    onError: (err: any) => {
      const errMsg = err?.message || "Failed to record contract signing.";
      setFeedback({
        type: "error",
        message: "Contract update error: " + errMsg,
      });
      notify.error("Contract Update Failed", err);
    },
  });

  const completeOrientationMutation = useMutation({
    mutationFn: (data: { orientationDate?: string; orientationNotes?: string }) =>
      taApi.completeOrientation(applicationId, data),
    onSuccess: (updatedApp: any, vars) => {
      queryClient.setQueryData<any>(["ta", "application", applicationId], (old: any) =>
        old
          ? {
              ...old,
              orientationCompleted: true,
              orientationDate: vars.orientationDate || old.orientationDate,
              orientationNotes: vars.orientationNotes || old.orientationNotes,
              ...(updatedApp?.status ? { status: updatedApp.status } : {}),
            }
          : old
      );
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId, "decisions"] });
      setOrientationModalOpen(false);
      setFeedback({
        type: "success",
        message: "Candidate orientation marked as completed.",
      });
      notify.success("Orientation Completed", "Orientation recorded successfully.");
    },
    onError: (err: any) => {
      const errMsg = err?.message || "Failed to record orientation.";
      setFeedback({
        type: "error",
        message: "Orientation update error: " + errMsg,
      });
      notify.error("Orientation Update Failed", err);
    },
  });

  const updateInterviewStatusMutation = useMutation({
    mutationFn: (data: {
      interviewId?: number;
      type?: InterviewType;
      result: "PASS" | "FAIL" | "NO_SHOW";
      notes?: string;
      conductedAt?: string;
    }) => {
      if (data.interviewId) {
        return taApi.updateInterviewStatus(applicationId, data.interviewId, {
          result: data.result,
          notes: data.notes,
          conductedAt: data.conductedAt || new Date().toISOString(),
        });
      } else {
        return taApi.recordInterviewDirectly(applicationId, {
          type:
            data.type ||
            (app?.status === ApplicationStatus.FINAL_INTERVIEW
              ? InterviewType.FINAL_INTERVIEW
              : InterviewType.INITIAL_SCREENING),
          result: data.result,
          notes: data.notes,
          conductedAt: data.conductedAt || new Date().toISOString(),
        });
      }
    },
    onSuccess: (updatedInterview: any, vars) => {
      queryClient.setQueryData<any>(["ta", "application", applicationId], (old: any) => {
        if (!old) return old;
        const newStatus =
          vars.result === "NO_SHOW"
            ? ApplicationStatus.ARCHIVED
            : vars.type === InterviewType.FINAL_INTERVIEW && vars.result === "PASS"
            ? ApplicationStatus.COMPLIANCE
            : old.status;
        const existingInterviews = old.interviews || [];
        const updatedInterviews = vars.interviewId
          ? existingInterviews.map((i: any) =>
              i.id === vars.interviewId
                ? { ...i, result: vars.result, notes: vars.notes, conductedAt: vars.conductedAt || new Date().toISOString() }
                : i
            )
          : updatedInterview
          ? [updatedInterview, ...existingInterviews]
          : existingInterviews;
        return {
          ...old,
          status: newStatus,
          isArchived: vars.result === "NO_SHOW" ? true : old.isArchived,
          interviews: updatedInterviews,
        };
      });
      queryClient.setQueriesData<any>({ queryKey: ["ta", "applications"] }, (old: any) => {
        if (!old) return old;
        const newStatus =
          vars.result === "NO_SHOW"
            ? ApplicationStatus.ARCHIVED
            : vars.type === InterviewType.FINAL_INTERVIEW && vars.result === "PASS"
            ? ApplicationStatus.COMPLIANCE
            : undefined;
        if (!newStatus) return old;
        if (Array.isArray(old)) {
          return old.map((item) =>
            String(item.id) === String(applicationId)
              ? { ...item, status: newStatus, isArchived: newStatus === ApplicationStatus.ARCHIVED ? true : item.isArchived }
              : item
          );
        }
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((item: any) =>
              String(item.id) === String(applicationId)
                ? { ...item, status: newStatus, isArchived: newStatus === ApplicationStatus.ARCHIVED ? true : item.isArchived }
                : item
            ),
          };
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId, "decisions"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "compliance", "interviews"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      setInterviewOutcomeModalOpen(false);
      setSelectedInterviewForOutcome(null);
      setInterviewOutcomeNotes("");
      const msg = `Interview evaluation recorded as ${vars.result}.`;
      setFeedback({
        type: "success",
        message: msg,
      });
      notify.success("Evaluation Result Logged", msg);
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Failed to update interview: " + (err.message || "An error occurred"),
      });
      notify.error("Interview Update Failed", err);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => taApi.analyzeApplication(applicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      const msg = "Candidate assessment and match score updated successfully.";
      setFeedback({ type: "success", message: msg });
      notify.success("AI Assessment Refreshed", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to refresh candidate assessment: " + err.message });
      notify.error("Assessment Failed", err);
    },
  });


  const scheduleInterviewMutation = useMutation({
    mutationFn: (data: { type: InterviewType; scheduledAt: string; notes?: string }) =>
      taApi.scheduleInterview(applicationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId, "decisions"] });
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      setInterviewModalOpen(false);
      setInterviewDate("");
      setInterviewNotes("");
      const msg = "Interview scheduled successfully.";
      setFeedback({ type: "success", message: msg });
      notify.success("Interview Scheduled", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to schedule interview: " + err.message });
      notify.error("Scheduling Failed", err);
    },
  });

  const endorseMutation = useMutation({
    mutationFn: (data: { clientId: number; outcome?: "PENDING" | "APPROVED" | "DECLINED" | "ENDORSED"; notes?: string }) =>
      taApi.recordEndorsement(applicationId, data),
    onSuccess: () => {
      queryClient.setQueryData<any>(["ta", "application", applicationId], (old: any) =>
        old ? { ...old, status: ApplicationStatus.CLIENT_ENDORSEMENT } : old
      );
      queryClient.setQueriesData<any>({ queryKey: ["ta", "applications"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((item) => (String(item.id) === String(applicationId) ? { ...item, status: ApplicationStatus.CLIENT_ENDORSEMENT } : item));
        }
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((item: any) => (String(item.id) === String(applicationId) ? { ...item, status: ApplicationStatus.CLIENT_ENDORSEMENT } : item)),
          };
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId, "decisions"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      setEndorseOutcome("PENDING");
      setEndorseNotes("");
      setEndorseModalOpen(false);
      const msg = "Candidate endorsed to client successfully. Candidate pipeline stage updated to Client Endorsement.";
      setFeedback({
        type: "success",
        message: msg,
      });
      notify.success("Client Endorsement Submitted", msg);
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Failed to record endorsement: " + (err?.response?.data?.message || err.message),
      });
      notify.error("Endorsement Failed", err);
    },
  });

  const updateEndorsementMutation = useMutation({
    mutationFn: (data: {
      endorsementId: number;
      outcome: "PENDING" | "APPROVED" | "DECLINED" | "ENDORSED";
      notes?: string;
    }) =>
      taApi.updateEndorsement(applicationId, data.endorsementId, {
        outcome: data.outcome,
        notes: data.notes,
      }),
    onSuccess: (_data: any, vars) => {
      queryClient.setQueryData<any>(["ta", "application", applicationId], (old: any) => {
        if (!old) return old;
        const existingEndorsements = old.clientEndorsements || [];
        const updated = existingEndorsements.map((e: any) =>
          e.id === vars.endorsementId
            ? { ...e, outcome: vars.outcome, notes: vars.notes }
            : e
        );
        return {
          ...old,
          clientEndorsements: updated,
        };
      });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId, "decisions"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "compliance", "interviews"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      setUpdateEndorsementModalOpen(false);
      setSelectedEndorsementId(null);
      setUpdateEndorsementNotes("");
      const outcomeLabel =
        vars.outcome === "APPROVED"
          ? "Approved by Client"
          : vars.outcome === "DECLINED"
          ? "Declined by Client"
          : "Pending Client Review";
      const msg = `Client acceptance recorded as ${outcomeLabel}.`;
      setFeedback({
        type: "success",
        message: msg,
      });
      notify.success("Client Acceptance Saved", msg);
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Failed to update client endorsement: " + (err?.message || "An error occurred"),
      });
      notify.error("Update Failed", err);
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
      const msg = "Compliance requirement added.";
      setFeedback({ type: "success", message: msg });
      notify.success("Requirement Added", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to add compliance requirement: " + err.message });
      notify.error("Addition Failed", err);
    },
  });

  const reviewComplianceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { reviewStatus: "APPROVED" | "REJECTED"; reviewNotes?: string } }) =>
      taApi.reviewComplianceRequirement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      setReviewReqId(null);
      setReviewReqNotes("");
      const msg = "Compliance requirement review saved.";
      setFeedback({ type: "success", message: msg });
      notify.success("Review Saved", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to review requirement: " + err.message });
      notify.error("Review Failed", err);
    },
  });

  const updateDeadlineMutation = useMutation({
    mutationFn: ({ id, deadline }: { id: number; deadline: string | null }) =>
      taApi.updateComplianceRequirementDeadline(id, deadline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      setEditDeadlineModalOpen(false);
      setEditDeadlineReqId(null);
      setEditDeadlineDate("");
      const msg = "Compliance requirement deadline updated.";
      setFeedback({ type: "success", message: msg });
      notify.success("Deadline Updated", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to update deadline: " + err.message });
      notify.error("Update Failed", err);
    },
  });

  const deployMutation = useMutation({
    mutationFn: (data: {
      clientId: number;
      site?: string;
      contractStart?: string;
      contractEnd?: string;
      notes?: string;
    }) => taApi.createDeployment(applicationId, data),
    onSuccess: (createdDeployment: any) => {
      queryClient.setQueryData<any>(["ta", "application", applicationId], (old: any) =>
        old
          ? {
              ...old,
              status: ApplicationStatus.DEPLOYED,
              deployments: createdDeployment ? [createdDeployment, ...(old.deployments || [])] : old.deployments,
            }
          : old
      );
      queryClient.setQueriesData<any>({ queryKey: ["ta", "applications"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((item) => (String(item.id) === String(applicationId) ? { ...item, status: ApplicationStatus.DEPLOYED } : item));
        }
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((item: any) => (String(item.id) === String(applicationId) ? { ...item, status: ApplicationStatus.DEPLOYED } : item)),
          };
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      setDeployModalOpen(false);
      setDeployNotes("");
      const msg = "Workforce deployment successfully created and activated.";
      setFeedback({ type: "success", message: msg });
      notify.success("Deployment Activated", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to create deployment: " + err.message });
      notify.error("Deployment Failed", err);
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
  const candidateInitials = [profile?.firstName?.[0], profile?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "ID";
  const scores = app.candidateScores?.[0];
  const decisions = Array.isArray(decisionsQuery.data) ? decisionsQuery.data : [];
  const clients = Array.isArray(clientsQuery.data) ? clientsQuery.data : [];

  const latestEndorsement = (app.clientEndorsements && app.clientEndorsements.length > 0) ? app.clientEndorsements[0] : null;

  // Linked Client & MRF from Application hierarchy or past endorsement
  const linkedClient = app.jobPosting?.mrf?.client || latestEndorsement?.client;
  const linkedClientId = linkedClient?.id || app.jobPosting?.mrf?.clientId || latestEndorsement?.clientId || 0;
  const linkedClientName = linkedClient?.name || (clients.find((c) => c.id === linkedClientId)?.name) || "";

  // Stage transition prerequisite checks
  const hasPassedScreening = (app.interviews || []).some(
    (i) => i.type === "INITIAL_SCREENING" && (i.result === "PASS" || i.result === "PASSED") && i.isActive !== false
  );
  const pendingScreeningInterview = (app.interviews || []).find(
    (i) => i.type === "INITIAL_SCREENING" && (!i.result || i.result === "PENDING" || i.result === "SCHEDULED") && i.isActive !== false
  );

  const isPendingClientReview = latestEndorsement?.outcome === "PENDING";
  const isClientDeclined = latestEndorsement?.outcome === "DECLINED";
  const isClientApproved = latestEndorsement?.outcome === "APPROVED" || latestEndorsement?.outcome === "ENDORSED";

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
  const canReject = !isTerminal;

  // Stage-bound contextual action booleans
  const isPreScreeningOrScreening = (
    [
      ApplicationStatus.SUBMITTED,
      ApplicationStatus.PARSING,
      ApplicationStatus.REVIEW,
      ApplicationStatus.MATCHED,
      ApplicationStatus.NEEDS_ATTENTION,
      ApplicationStatus.INITIAL_SCREENING,
    ] as ApplicationStatus[]
  ).includes(app.status);

  const canScheduleInitialInterview =
    isPreScreeningOrScreening && !hasPassedScreening && !pendingScreeningInterview && !isTerminal;
  const canRecordInitialInterview =
    isPreScreeningOrScreening && Boolean(pendingScreeningInterview) && !isTerminal;
  const canAdvanceToClientEndorsement =
    hasPassedScreening &&
    (app.status === ApplicationStatus.INITIAL_SCREENING || isPreScreeningOrScreening) &&
    !isTerminal;

  const isClientEndorsementStage = app.status === ApplicationStatus.CLIENT_ENDORSEMENT;

  const isFinalInterviewStage = app.status === ApplicationStatus.FINAL_INTERVIEW;
  const canScheduleFinalInterview =
    isFinalInterviewStage && !hasPassedFinalInterview && !pendingFinalInterview && !isTerminal;
  const canRecordFinalInterview =
    isFinalInterviewStage && !hasPassedFinalInterview && Boolean(pendingFinalInterview) && !isTerminal;
  const canAdvanceToCompliance =
    isFinalInterviewStage && hasPassedFinalInterview && !isTerminal;

  const isComplianceStage = app.status === ApplicationStatus.COMPLIANCE;
  const canAdvanceToContractAndOrientation =
    isComplianceStage && !hasUnapprovedMandatoryCompliance && !isTerminal;

  const isContractAndOrientationStage =
    app.status === ApplicationStatus.CONTRACT_AND_ORIENTATION ||
    app.status === ApplicationStatus.ONBOARDING ||
    (app.status as string) === "ONBOARDING" ||
    (app.status as string) === "HIRED";
  const isContractSigned = Boolean(app.contractSigned || app.contractSignedAt);
  const isOrientationCompleted = Boolean(app.orientationCompleted || app.orientationCompletedAt);
  const isReadyForDeployment =
    !isTerminal &&
    !hasUnapprovedMandatoryCompliance &&
    isContractSigned &&
    isOrientationCompleted;
  const canDeployCandidate = isReadyForDeployment;

  const totalCompReqs = app.complianceRequirements?.length || 0;
  const approvedCompReqs = (app.complianceRequirements || []).filter((r) => r.reviewStatus === "APPROVED").length;
  const submittedCompReqs = (app.complianceRequirements || []).filter((r) => r.reviewStatus === "SUBMITTED").length;
  const missingCompReqs = (app.complianceRequirements || []).filter((r) => !r.documentId && r.reviewStatus !== "APPROVED").length;

  const isAllClearancesApproved = totalCompReqs > 0 && approvedCompReqs === totalCompReqs;
  const requirementsListExpanded = manualRequirementsToggle !== null ? manualRequirementsToggle : !isAllClearancesApproved;
  const setRequirementsListExpanded = (val: boolean | ((prev: boolean) => boolean)) => {
    if (typeof val === "function") setManualRequirementsToggle(val(requirementsListExpanded));
    else setManualRequirementsToggle(val);
  };

  const isPastClientReview =
    !isPreScreeningOrScreening &&
    app.status !== ApplicationStatus.CLIENT_ENDORSEMENT;

  // Contextual attention badges for the 3 main tabs
  const evaluationBadge = pendingScreeningInterview || pendingFinalInterview
    ? "1 Interview"
    : isPreScreeningOrScreening && !hasPassedScreening
    ? "Review Needed"
    : undefined;

  const complianceBadge = canDeployCandidate
    ? "Ready to Deploy"
    : submittedCompReqs > 0
    ? `${submittedCompReqs} Under Review`
    : missingCompReqs > 0
    ? `${missingCompReqs} Pending`
    : undefined;

  const tabs: {
    id: TabKey;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: { text: string; variant: "success" | "warning" | "info" };
  }[] = [
    {
      id: "evaluation",
      label: "Candidate & Evaluation",
      icon: UserCheck,
      badge: evaluationBadge
        ? {
            text: evaluationBadge,
            variant: evaluationBadge.includes("Interview") ? "info" : "warning",
          }
        : undefined,
    },
    {
      id: "compliance",
      label: "Compliance & Deployment",
      icon: ShieldCheck,
      badge: complianceBadge
        ? {
            text: complianceBadge,
            variant:
              complianceBadge === "Ready to Deploy"
                ? "success"
                : complianceBadge.includes("Review")
                ? "info"
                : "warning",
          }
        : undefined,
    },
    { id: "history", label: "Activity & Audit", icon: History },
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
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-teal-600" />}
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
      <div className="bg-white border border-slate-300 p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                Pipeline:
              </span>
              <StatusBadge status={app.status} size="sm" />
              <ScoreBadge score={scores?.finalFitScore ?? app.candidateFitScore ?? app.aiScore} size="sm" />
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-[11px] text-slate-500">
                Submitted {formatDate(app.createdAt)}
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-[11px] text-slate-600 font-medium">
                {app.user?.email}
              </span>
              {profile?.mobileNumber && (
                <>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <span className="text-[11px] text-slate-600">
                    {profile.mobileNumber}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* INITIAL_SCREENING Actions */}
            {canScheduleInitialInterview && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Calendar className="w-3.5 h-3.5" />}
                onClick={() => {
                  setInterviewType(InterviewType.INITIAL_SCREENING);
                  setInterviewDate("");
                  setInterviewNotes("");
                  setInterviewModalOpen(true);
                }}
              >
                Schedule Initial Interview
              </Button>
            )}
            {canRecordInitialInterview && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setSelectedInterviewForOutcome(pendingScreeningInterview || null);
                    setInterviewOutcomeResult("PASS");
                    setInterviewOutcomeNotes(pendingScreeningInterview?.notes || "");
                    setInterviewOutcomeModalOpen(true);
                  }}
                >
                  Record Screening Result
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Calendar className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setInterviewType(InterviewType.INITIAL_SCREENING);
                    setInterviewDate(
                      pendingScreeningInterview?.scheduledAt
                        ? new Date(pendingScreeningInterview.scheduledAt).toISOString().slice(0, 16)
                        : ""
                    );
                    setInterviewNotes(pendingScreeningInterview?.notes || "");
                    setInterviewModalOpen(true);
                  }}
                >
                  Reschedule
                </Button>
              </>
            )}
            {canAdvanceToClientEndorsement && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Building2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  setEndorseOutcome("PENDING");
                  setEndorseNotes("");
                  setEndorseModalOpen(true);
                }}
              >
                Endorse to Client
              </Button>
            )}

            {/* STAGE 2: CLIENT_ENDORSEMENT Stage Actions */}
            {isClientEndorsementStage && (
              <>
                {!latestEndorsement && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Building2 className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setEndorseOutcome("PENDING");
                      setEndorseNotes("");
                      setEndorseModalOpen(true);
                    }}
                  >
                    Endorse to Client
                  </Button>
                )}
                {latestEndorsement && isPendingClientReview && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Building2 className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setSelectedEndorsementId(latestEndorsement.id);
                      setSelectedEndorsementClientName(latestEndorsement.client?.name || linkedClientName);
                      setUpdateEndorsementOutcome("APPROVED");
                      setUpdateEndorsementNotes(latestEndorsement.notes || "");
                      setUpdateEndorsementModalOpen(true);
                    }}
                  >
                    Record Client Acceptance
                  </Button>
                )}
                {latestEndorsement && (isClientApproved || isClientDeclined) && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Building2 className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setSelectedEndorsementId(latestEndorsement.id);
                      setSelectedEndorsementClientName(latestEndorsement.client?.name || linkedClientName);
                      setUpdateEndorsementOutcome(latestEndorsement.outcome as any);
                      setUpdateEndorsementNotes(latestEndorsement.notes || "");
                      setUpdateEndorsementModalOpen(true);
                    }}
                  >
                    Update Client Acceptance
                  </Button>
                )}
              </>
            )}

            {/* FINAL_INTERVIEW Actions */}
            {canScheduleFinalInterview && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Calendar className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setInterviewType(InterviewType.FINAL_INTERVIEW);
                    setInterviewDate("");
                    setInterviewNotes("");
                    setInterviewModalOpen(true);
                  }}
                >
                  Schedule Client Interview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setSelectedInterviewForOutcome(null);
                    setInterviewOutcomeResult("PASS");
                    setInterviewOutcomeNotes("");
                    setInterviewOutcomeModalOpen(true);
                  }}
                >
                  Record Client Result
                </Button>
              </>
            )}
            {canRecordFinalInterview && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setSelectedInterviewForOutcome(pendingFinalInterview || null);
                    setInterviewOutcomeResult("PASS");
                    setInterviewOutcomeNotes(pendingFinalInterview?.notes || "");
                    setInterviewOutcomeModalOpen(true);
                  }}
                >
                  Record Client Result
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Calendar className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setInterviewType(InterviewType.FINAL_INTERVIEW);
                    setInterviewDate(
                      pendingFinalInterview?.scheduledAt
                        ? new Date(pendingFinalInterview.scheduledAt).toISOString().slice(0, 16)
                        : ""
                    );
                    setInterviewNotes(pendingFinalInterview?.notes || "");
                    setInterviewModalOpen(true);
                  }}
                >
                  Reschedule
                </Button>
              </>
            )}
            {canAdvanceToCompliance && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                loading={updateStatusMutation.isPending}
                onClick={() => {
                  updateStatusMutation.mutate({
                    status: ApplicationStatus.COMPLIANCE,
                    reason: "Client accepted candidate for employment",
                  });
                }}
              >
                Advance to Requirements
              </Button>
            )}

            {/* STAGE 5: COMPLIANCE Actions */}
            {isComplianceStage && (
              <>
                {canAdvanceToContractAndOrientation ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<FileCheck className="w-3.5 h-3.5" />}
                    loading={updateStatusMutation.isPending}
                    onClick={() => {
                      updateStatusMutation.mutate({
                        status: ApplicationStatus.CONTRACT_AND_ORIENTATION,
                        reason: "All mandatory clearances verified and approved.",
                      });
                    }}
                  >
                    Advance to Contract & Orientation
                  </Button>
                ) : (
                  <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
                    Pending Mandatory Clearances
                  </span>
                )}
              </>
            )}

            {/* STAGE 6: CONTRACT_AND_ORIENTATION Actions */}
            {isContractAndOrientationStage && (
              <div className="flex flex-wrap items-center gap-2">
                {isReadyForDeployment && activeTab !== "compliance" && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Truck className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setDeployClientId(linkedClientId || latestEndorsement?.clientId || 0);
                      setDeploySite(app.jobPosting?.location || (app.jobPosting?.mrf as any)?.location || (linkedClient as any)?.address || "");
                      setDeployModalOpen(true);
                    }}
                  >
                    Deploy Candidate
                  </Button>
                )}
                {!isReadyForDeployment && activeTab !== "compliance" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTabChange("compliance")}
                  >
                    Manage Onboarding
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Stepper Visualizer */}
        <div className="pt-2">
          <PipelineIndicator currentStatus={app.status} />
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        {/* Navigation Tabs Header */}
        <div role="tablist" className="flex items-center border-b border-slate-300 overflow-x-auto bg-slate-100 divide-x divide-slate-300 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
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
                {tab.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-tight border ${
                      tab.badge.variant === "success"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : tab.badge.variant === "info"
                        ? "bg-blue-50 text-blue-800 border-blue-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {tab.badge.text}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-3.5 sm:p-6">
          {/* ========================================================================= */}
          {/* TAB 1: CANDIDATE & EVALUATION */}
          {/* ========================================================================= */}
          {activeTab === "evaluation" && (
            <div className="space-y-8">
              {/* SECTION A: Candidate Demographics, Records & Inline Resume Viewer */}
              <div id="eval-profile" className="space-y-4">
                {!isResumeOpen && (
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                    <span className="text-xs font-mono font-bold uppercase text-slate-500">
                      Candidate Dossier & Profile
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<FileText className="w-3.5 h-3.5 text-teal-700" />}
                      onClick={() => toggleResume(true)}
                      aria-label="View Resume"
                      title="Show resume panel side-by-side"
                    >
                      View Resume
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start transition-all duration-200">
                  {/* Left / Profile Column: Structured Records */}
                  <div className={`${isResumeOpen ? "lg:col-span-5 xl:col-span-5" : "col-span-12"} transition-all duration-200`}>
                    <div className={isResumeOpen ? "space-y-6" : "grid grid-cols-1 md:grid-cols-2 gap-6 items-start"}>
                      {/* Left Sub-Group in Collapsed, or First Group in Split */}
                      <div className="space-y-6">
                        {/* 1. Personal & Contact Demographics */}
                        <div className="space-y-3">
                          <div className="border-b border-slate-200 pb-2">
                            <h4 className="text-xs font-mono font-bold uppercase text-slate-600">
                              Personal & Contact Demographics
                            </h4>
                          </div>

                          <div className="flex items-start gap-4 pt-1">
                            {/* 2x2 Photo Avatar Preview */}
                            <div className="shrink-0">
                              {profile?.photoUrl && !photoImgError ? (
                                <img
                                  src={profile.photoUrl}
                                  alt="Profile"
                                  className="w-16 h-16 rounded-md object-cover border border-slate-300 shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                                  onError={() => setPhotoImgError(true)}
                                  onClick={() => {
                                    const docId = extractDocumentId(profile.photoUrl);
                                    setPreviewDocState({
                                      open: true,
                                      documentId: docId,
                                      fileUrl: profile.photoUrl,
                                      title: "Identification Photo",
                                    });
                                  }}
                                  title="Click to view full photo"
                                />
                              ) : (
                                <div
                                  aria-hidden="true"
                                  className="flex h-16 w-16 items-center justify-center rounded-md bg-teal-50 text-base font-semibold text-teal-800 ring-1 ring-inset ring-teal-200"
                                >
                                  {candidateInitials}
                                </div>
                              )}
                            </div>

                            {/* Demographics details */}
                            <div className="space-y-1.5 text-xs flex-1 min-w-0">
                              <div className="grid grid-cols-3">
                                <span className="text-slate-600 font-mono font-medium">Full Name:</span>
                                <span className="col-span-2 font-semibold text-slate-950 truncate">{candidateName}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-slate-600 font-mono font-medium">Contact Phone:</span>
                                <span className="col-span-2 text-slate-800 font-mono">{profile?.mobileNumber || "N/A"}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-slate-600 font-mono font-medium">Current Address:</span>
                                <span className="col-span-2 text-slate-800">{profile?.address || "N/A"}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-slate-600 font-mono font-medium">Region:</span>
                                <span className="col-span-2 text-slate-800">{profile?.city ? `${profile.city}, ${profile.province}` : "Philippines"}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-slate-600 font-mono font-medium">Date of Birth:</span>
                                <span className="col-span-2 text-slate-800 font-mono">{profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : "N/A"}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. Target Job Requisition & Suitability */}
                        <div className="space-y-3 pt-4 border-t border-slate-200">
                          <h4 className="text-xs font-mono font-bold uppercase text-slate-600 border-b border-slate-100 pb-2">
                            Target Job Requisition
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-3">
                              <span className="text-slate-600 font-mono font-medium">Position Title:</span>
                              <span className="col-span-2 font-bold text-slate-900">{app.jobPosting?.title || "N/A"}</span>
                            </div>
                            <div className="grid grid-cols-3">
                              <span className="text-slate-600 font-mono font-medium">Location:</span>
                              <span className="col-span-2 text-slate-800">{app.jobPosting?.location || "Philippines"}</span>
                            </div>
                            <div className="grid grid-cols-3">
                              <span className="text-slate-600 font-mono font-medium">Status:</span>
                              <span className="col-span-2 font-mono">{app.jobPosting?.status || "OPEN"}</span>
                            </div>
                            <div className="grid grid-cols-3 items-center">
                              <span className="text-slate-600 font-mono font-medium">
                                <span>Suitability Match</span>:
                              </span>
                              <div className="col-span-2 flex items-center gap-2">
                                <ScoreBadge score={scores?.finalFitScore ?? app.candidateFitScore ?? app.aiScore} size="sm" />
                                <button
                                  type="button"
                                  onClick={() => document.getElementById("eval-qualifications")?.scrollIntoView({ behavior: "smooth" })}
                                  className="text-[11px] text-teal-700 hover:underline font-mono cursor-pointer"
                                >
                                  Breakdown &darr;
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Sub-Group in Collapsed, or Second Group in Split */}
                      <div className="space-y-6">
                        {/* 4. Employment History (Prioritized before Skills) */}
                        <div className={`space-y-3 ${isResumeOpen ? "pt-4 border-t border-slate-200" : "pt-4 md:pt-0 border-t md:border-t-0 border-slate-200"}`}>
                          <h4 className="text-xs font-mono font-bold uppercase text-slate-600 border-b border-slate-200 pb-2">
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

                        {/* 5. Educational Attainment */}
                        <div className="space-y-3 pt-4 border-t border-slate-200">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <h4 className="text-xs font-mono font-bold uppercase text-slate-600">
                              Educational Attainment
                            </h4>
                            {profile?.educations && profile.educations.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setIsEducationExpanded(!isEducationExpanded)}
                                className="text-[11px] font-mono text-teal-700 hover:underline cursor-pointer"
                              >
                                {isEducationExpanded ? "Show Compact" : `View All (${profile.educations.length})`}
                              </button>
                            )}
                          </div>
                          {!profile?.educations || profile.educations.length === 0 ? (
                            <p className="text-xs text-slate-400">No education entries on file.</p>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {(isEducationExpanded ? profile.educations : profile.educations.slice(0, 1)).map((edu: any) => (
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
                      </div>

                      {/* 6. Competencies & Skills (Appears after Work Experience and Education) */}
                      <div className={`space-y-3 pt-4 border-t border-slate-200 ${!isResumeOpen ? "md:col-span-2" : ""}`}>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h4 className="text-xs font-mono font-bold uppercase text-slate-600">
                            Competencies & Skills
                          </h4>
                          {profile?.skills && profile.skills.length > 8 && (
                            <button
                              type="button"
                              onClick={() => setIsSkillsExpanded(!isSkillsExpanded)}
                              className="text-[11px] font-mono text-teal-700 hover:underline cursor-pointer"
                            >
                              {isSkillsExpanded ? "Show Top 8" : `View All (${profile.skills.length})`}
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {profile?.skills && profile.skills.length > 0 ? (
                            (isSkillsExpanded ? profile.skills : profile.skills.slice(0, 8)).map((s: any, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-slate-100/90 text-slate-700 text-[11px] font-medium border border-slate-200"
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
                  </div>

                  {/* Right Column: Sticky Inline Resume & Document Viewer */}
                  {isResumeOpen && (
                    <div className="lg:col-span-7 xl:col-span-7 lg:sticky lg:top-4 space-y-4 transition-all duration-200">
                      <InlineResumeViewer
                        resumeUrl={profile?.resumeUrl || app.resumeUrl}
                        candidateName={candidateName}
                        candidateInitials={candidateInitials}
                        onOpenFullscreen={() => {
                          const resumeUrlToPreview = profile?.resumeUrl || app.resumeUrl;
                          const docId = extractDocumentId(resumeUrlToPreview);
                          setPreviewDocState({
                            open: true,
                            documentId: docId,
                            fileUrl: resumeUrlToPreview,
                            title: "Application Resume (CV)",
                          });
                        }}
                        onCollapse={() => toggleResume(false)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION B: AI Suitability & Match Score Breakdown */}
              <div id="eval-qualifications" className="pt-6 border-t border-slate-200 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-teal-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Candidate Suitability & Match Score
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 font-sans">
                      Calculated based on candidate qualifications, work experience, location, and job requirements
                    </p>
                  </div>
                  <ScoreBadge score={scores?.finalFitScore ?? app.candidateFitScore ?? app.aiScore} size="lg" />
                </div>

                {scores ? (
                  <div className="border border-slate-300 bg-white grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-300 rounded-md overflow-hidden">
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
                  <div className="p-4 bg-slate-50 border border-slate-300 text-center text-xs font-mono text-slate-500 rounded-md">
                    Detailed criteria score breakdown is being calculated.
                  </div>
                )}

                {/* Candidate Assessment & Recommendation */}
                {parsedAiAssessment && (
                  <div id="eval-assessment" className="border border-slate-300 bg-white shadow-xs rounded-md overflow-hidden">
                    <div className="px-4 py-3 bg-teal-50 border-b border-slate-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-teal-800" />
                        <h4 className="text-xs font-bold font-mono text-teal-950 uppercase tracking-wide">
                          Candidate Assessment & Recommendation
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-white text-teal-900 border border-slate-300 rounded-md">
                        AI Qualitative Analysis
                      </span>
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

              {/* SECTION C: Interview Management */}
              <div id="eval-interviews" className="pt-6 border-t border-slate-200 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Scheduled Interviews ({app.interviews?.length || 0})
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      Track candidate interviews, evaluate outcomes, and log recruiter feedback
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.interviews && app.interviews.length > 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsInterviewHistoryExpanded(!isInterviewHistoryExpanded)}
                      >
                        {isInterviewHistoryExpanded ? "Show Recent (2)" : `View All (${app.interviews.length})`}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5 text-teal-600" />}
                      onClick={() => {
                        setInterviewType(InterviewType.INITIAL_SCREENING);
                        setInterviewDate("");
                        setInterviewNotes("");
                        setInterviewModalOpen(true);
                      }}
                    >
                      Schedule Interview
                    </Button>
                  </div>
                </div>

                {!app.interviews || app.interviews.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-md border border-dashed border-slate-200">
                    No interviews scheduled yet. Click "Schedule Interview" to initiate candidate assessment.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {(isInterviewHistoryExpanded ? app.interviews : app.interviews.slice(0, 2)).map((int) => {
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
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
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

              {/* SECTION D: Similar Talent in Pool (Collapsible Drawer / Section) */}
              <div id="eval-similar-pool" className="pt-6 border-t border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-teal-600" />
                      <h3 className="text-sm font-bold text-slate-900">Similar Talent in Pool</h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      Pre-screened and archived talent with matching skills and qualifications
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSimilarTalentOpen((prev) => !prev)}
                      leftIcon={similarTalentOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    >
                      {similarTalentOpen ? "Hide Talent Matches" : "Find Similar Candidates"}
                    </Button>
                    <Link to="/ta/talent-pool">
                      <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3 h-3" />}>
                        Open Talent Pool
                      </Button>
                    </Link>
                  </div>
                </div>

                {similarTalentOpen && (
                  <div className="pt-2">
                    {similarCandidatesQuery.isLoading ? (
                      <LoadingState variant="cards" />
                    ) : similarCandidatesQuery.isError ? (
                      <ErrorState error={similarCandidatesQuery.error} onRetry={() => similarCandidatesQuery.refetch()} />
                    ) : (similarCandidatesQuery.data || []).length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-md space-y-2">
                        <Users className="w-6 h-6 text-teal-600 mx-auto" />
                        <h4 className="text-xs font-mono font-bold uppercase text-slate-800">
                          No Similar Talent Pool Candidates Found
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          No other candidate profiles in the talent pool closely match this applicant's profile and qualifications.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(similarCandidatesQuery.data || []).map((res) => {
                          const c = res.candidate;
                          const simPercent = Math.round((res.similarity || 0) * 100);

                          return (
                            <div
                              key={c.id}
                              className="p-4 rounded-md border border-slate-200 hover:border-teal-300 transition-colors bg-white flex flex-col justify-between space-y-3 shadow-xs"
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-sm font-bold text-slate-900">
                                        {c.firstName} {c.lastName}
                                      </h4>
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                        {c.availability}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                                      {c.email}
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-50 text-teal-900 border border-teal-200 text-xs font-mono font-bold">
                                      <Users className="w-3 h-3 text-teal-600" />
                                      <span>{simPercent}% Match</span>
                                    </span>
                                  </div>
                                </div>

                                {c.currentRole && (
                                  <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                                    <span>{c.currentRole}</span>
                                  </div>
                                )}

                                {(c.city || c.province) && (
                                  <div className="text-xs text-slate-600 flex items-center gap-1.5 font-mono">
                                    <span>{[c.city, c.province].filter(Boolean).join(", ")}</span>
                                  </div>
                                )}

                                {c.skills && c.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {c.skills.slice(0, 5).map((s: any, idx: number) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                                      >
                                        {typeof s === "string" ? s : s.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                                <Link to="/ta/talent-pool">
                                  <Button variant="outline" size="sm" rightIcon={<ArrowLeft className="w-3 h-3 rotate-180" />}>
                                    View in Talent Pool
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: COMPLIANCE & DEPLOYMENT */}
          {/* ========================================================================= */}
          {activeTab === "compliance" && (
            <div className="space-y-8">
              {/* ========================================================================= */}
              {/* SECTION 1: Client Endorsements & Presentation History */}
              {/* ========================================================================= */}
              <div id="compliance-endorsements-section" className="space-y-4">
                {isPastClientReview && (!app.clientEndorsements || app.clientEndorsements.length === 0) ? (
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800">Client Endorsement:</span>
                      <span className="text-slate-500">None Recorded</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setManualClientId(linkedClientId || null);
                        setEndorseOutcome("PENDING");
                        setEndorseNotes("");
                        setEndorseModalOpen(true);
                      }}
                    >
                      Record Endorsement
                    </Button>
                  </div>
                ) : isPastClientReview && !endorsementsExpanded ? (
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="font-semibold text-slate-800">Client Endorsement:</span>
                      {isClientApproved ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          ✓ {latestEndorsement?.client?.name || "Client"} (Accepted)
                        </span>
                      ) : isClientDeclined ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200">
                          ✕ {latestEndorsement?.client?.name || "Client"} (Declined)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                          {latestEndorsement?.client?.name || "Client"} (Pending)
                        </span>
                      )}
                      <span className="text-slate-400 text-[11px] hidden sm:inline font-mono">
                        ({app.clientEndorsements?.length || 0} {(app.clientEndorsements?.length || 0) === 1 ? "record" : "records"})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEndorsementsExpanded(true)}
                      >
                        Details ({app.clientEndorsements?.length || 0}) ↓
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setManualClientId(linkedClientId || null);
                          setEndorseOutcome("PENDING");
                          setEndorseNotes("");
                          setEndorseModalOpen(true);
                        }}
                      >
                        Record
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-teal-600" />
                          <h3 className="text-sm font-bold text-slate-900">Client Endorsement Records</h3>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                            {app.clientEndorsements?.length || 0} Records
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Candidate presentations to client hiring managers and endorsement decisions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPastClientReview && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEndorsementsExpanded(false)}
                          >
                            Hide Details ↑
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setManualClientId(linkedClientId || null);
                            setEndorseOutcome("PENDING");
                            setEndorseNotes("");
                            setEndorseModalOpen(true);
                          }}
                        >
                          Record Endorsement
                        </Button>
                      </div>
                    </div>

                    {!app.clientEndorsements || app.clientEndorsements.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-md border border-dashed border-slate-200">
                        No endorsements recorded. Candidates must pass initial screening before client presentation.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {app.clientEndorsements.map((end) => (
                          <div key={end.id} className="py-4 flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{end.client?.name || "Client"}</span>
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                                  end.outcome === "APPROVED" || end.outcome === "ENDORSED"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : end.outcome === "DECLINED"
                                    ? "bg-rose-50 text-rose-800 border-rose-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                }`}>
                                  {end.outcome === "APPROVED" || end.outcome === "ENDORSED"
                                    ? "APPROVED (Client Accepted)"
                                    : end.outcome === "DECLINED"
                                    ? "DECLINED (Client Rejected)"
                                    : "PENDING (Under Review)"}
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
                                Update Client Acceptance
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ========================================================================= */}
              {/* SECTION 2: 201 Pre-employment Clearances & Document Checklist */}
              {/* ========================================================================= */}
              <div id="compliance-checklist-section" className="pt-6 border-t border-slate-200 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-teal-600" />
                      <h3 className="text-sm font-bold text-slate-900">Pre-Employment Requirements Checklist</h3>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                        201 Clearances
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Standard statutory clearances (NBI, SSS, PhilHealth, Pag-IBIG, Medical, Contract) required before field deployment
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.complianceRequirements && app.complianceRequirements.length > 0 && (!isAllClearancesApproved || requirementsListExpanded) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRequirementsListExpanded(!requirementsListExpanded)}
                      >
                        {requirementsListExpanded ? "Collapse Requirements" : `View Requirements (${app.complianceRequirements.length})`}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setComplianceDocLabel("");
                        setComplianceDeadline(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
                        setComplianceModalOpen(true);
                      }}
                    >
                      Add Requirement
                    </Button>
                  </div>
                </div>

                {!app.complianceRequirements || app.complianceRequirements.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-md border border-dashed border-slate-200">
                    No compliance requirements generated yet. Standard checklist is created automatically upon hiring.
                  </div>
                ) : isAllClearancesApproved && !requirementsListExpanded ? (
                  <div className="flex items-center justify-between p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-md text-xs font-mono text-emerald-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">All {totalCompReqs} Pre-Employment Clearances Approved</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-emerald-800 font-normal">All clearances verified · Ready for contract</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                      onClick={() => setRequirementsListExpanded(true)}
                    >
                      View Requirements ({totalCompReqs})
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Simplified Requirements Summary Hierarchy (Point 5) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {approvedCompReqs} / {totalCompReqs} requirements approved
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">
                          {submittedCompReqs} awaiting review · {missingCompReqs} missing
                        </span>
                      </div>
                      {hasUnapprovedMandatoryCompliance ? (
                        <span className="text-[11px] font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Clearances pending verification
                        </span>
                      ) : totalCompReqs > 0 && approvedCompReqs === totalCompReqs ? (
                        <span className="text-[11px] font-semibold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ✓ All clearances verified · Ready for contract
                        </span>
                      ) : null}
                    </div>

                    {requirementsListExpanded && (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                        {app.complianceRequirements.map((req) => {
                          const isApproved = req.reviewStatus === "APPROVED";
                          const isRejected = req.reviewStatus === "REJECTED";
                          const isUnderReview = !isApproved && !isRejected && Boolean(req.documentId || req.reviewStatus === "SUBMITTED");

                          const now = new Date();
                          const deadlineDate = req.deadline ? new Date(req.deadline) : null;
                          const isOverdue = deadlineDate && deadlineDate < now && !isApproved;
                          const diffDays = deadlineDate ? Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                          const isDueSoon = diffDays !== null && diffDays >= 0 && diffDays <= 3 && !isApproved;

                          return (
                            <div
                              key={req.id}
                              className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                isApproved ? "bg-white" : isDueSoon || isOverdue ? "bg-amber-50/20" : "bg-white"
                              }`}
                            >
                              {/* Left: Icon + Title + Secondary Metadata */}
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className="shrink-0 mt-0.5">
                                  {isApproved ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  ) : isRejected ? (
                                    <XCircle className="w-4 h-4 text-rose-600" />
                                  ) : isUnderReview ? (
                                    <Clock className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>

                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900">{req.documentLabel}</span>
                                    {!req.isRequired && (
                                      <span className="text-[10px] font-sans font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                        Optional
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center flex-wrap gap-2 text-[11px] font-mono">
                                    {deadlineDate ? (
                                      <>
                                        <span className="text-slate-600">
                                          Deadline: {formatDate(req.deadline)}
                                        </span>
                                        {isOverdue && (
                                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">
                                            OVERDUE
                                          </span>
                                        )}
                                        {isDueSoon && (
                                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                            DUE IN {diffDays} {diffDays === 1 ? "DAY" : "DAYS"}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditDeadlineReqId(req.id);
                                            setEditDeadlineDate(new Date(req.deadline!).toISOString().split('T')[0]);
                                            setEditDeadlineModalOpen(true);
                                          }}
                                          className="text-slate-500 hover:text-teal-700 text-xs font-sans font-medium underline underline-offset-2 cursor-pointer transition-colors"
                                          title="Adjust or extend deadline"
                                        >
                                          Edit
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-slate-500">No deadline set</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditDeadlineReqId(req.id);
                                            setEditDeadlineDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
                                            setEditDeadlineModalOpen(true);
                                          }}
                                          className="text-slate-500 hover:text-teal-700 text-xs font-sans font-medium underline underline-offset-2 cursor-pointer transition-colors"
                                        >
                                          + Set Deadline
                                        </button>
                                      </>
                                    )}

                                    {isApproved && !req.documentId && (
                                      <span className="text-emerald-700 font-sans">• Clearance verified</span>
                                    )}
                                  </div>

                                  {req.reviewNotes && (
                                    <p className="text-[11px] text-slate-600 italic mt-0.5">
                                      Reviewer note: {req.reviewNotes}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Right: Exactly ONE status badge, then action buttons */}
                              <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                                <span
                                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${
                                    isApproved
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      : isRejected
                                      ? "bg-rose-50 text-rose-800 border-rose-200"
                                      : isUnderReview
                                      ? "bg-blue-50 text-blue-800 border-blue-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {isApproved
                                    ? "APPROVED"
                                    : isRejected
                                    ? "REJECTED"
                                    : isUnderReview
                                    ? "UNDER REVIEW"
                                    : req.isRequired
                                    ? "NOT SUBMITTED"
                                    : "OPTIONAL"}
                                </span>

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
                                    {!isApproved && (
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
                                    {!isRejected && (
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setReviewReqId(req.id);
                                      setReviewReqStatus(req.reviewStatus === "REJECTED" ? "REJECTED" : "APPROVED");
                                      setReviewReqNotes(req.reviewNotes || "");
                                    }}
                                  >
                                    Review
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ========================================================================= */}
              {/* SECTION 3: Contract Signing & Orientation Completion + Final Workforce Deployment */}
              {/* ========================================================================= */}
              <div id="compliance-onboarding-section" className="pt-6 border-t border-slate-200 space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-bold text-slate-900">Contract, Orientation & Workforce Deployment</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Monitor employment contract completion, schedule orientation, and execute final roster deployment
                  </p>
                </div>

                <OnboardingDeploymentStepper
                  app={app}
                  totalCompReqs={totalCompReqs}
                  approvedCompReqs={approvedCompReqs}
                  hasUnapprovedMandatoryCompliance={hasUnapprovedMandatoryCompliance}
                  isComplianceStage={isComplianceStage}
                  canAdvanceToContractAndOrientation={canAdvanceToContractAndOrientation}
                  isAdvancingToContractAndOrientation={updateStatusMutation.isPending}
                  isContractAndOrientationStage={isContractAndOrientationStage}
                  isContractSigned={isContractSigned}
                  isOrientationCompleted={isOrientationCompleted}
                  isReadyForDeployment={isReadyForDeployment}
                  canDeployCandidate={canDeployCandidate}
                  linkedClientName={linkedClientName}
                  onOpenComplianceTab={() => {
                    document.getElementById("compliance-checklist-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  onAdvanceToContractAndOrientation={() => {
                    updateStatusMutation.mutate({
                      status: ApplicationStatus.CONTRACT_AND_ORIENTATION,
                      reason: "All mandatory clearances approved. Moving to contract signing and orientation.",
                    });
                  }}
                  onRecordContract={() => {
                    setContractNotes(app.contractNotes || "");
                    setContractDocumentUrl(app.contractDocumentUrl || "");
                    setContractModalOpen(true);
                  }}
                  onRecordOrientation={() => {
                    setOrientationDate(
                      app.orientationDate
                        ? new Date(app.orientationDate).toISOString().split("T")[0]
                        : new Date().toISOString().split("T")[0]
                    );
                    setOrientationNotes(app.orientationNotes || "");
                    setOrientationModalOpen(true);
                  }}
                  onDeployCandidate={() => {
                    setDeployClientId(linkedClientId || latestEndorsement?.clientId || 0);
                    setDeploySite(
                      app.jobPosting?.location ||
                        (app.jobPosting?.mrf as any)?.location ||
                        (linkedClient as any)?.address ||
                        ""
                    );
                    setDeployModalOpen(true);
                  }}
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: ACTIVITY & AUDIT */}
          {/* ========================================================================= */}
          {activeTab === "history" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm font-bold text-slate-900">Activity & Audit Trail</h3>
                </div>
                <p className="text-xs text-slate-500">
                  Chronological record of recruiter decisions, pipeline status changes, and administrative actions
                </p>
              </div>

              {decisions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-md border border-dashed border-slate-200">
                  No manual recruiter decisions recorded yet. Initial submission created by applicant.
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                  {decisions.map((dec) => (
                    <div key={dec.id} className="flex items-start gap-4 relative">
                      <div className="w-7 h-7 rounded-full bg-teal-50 border-2 border-teal-600 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <History className="w-3.5 h-3.5 text-teal-700" />
                      </div>
                      <div className="p-3.5 bg-white rounded-md border border-slate-200 shadow-xs flex-1 space-y-2 text-xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-900 border border-slate-200">
                            <span>{dec.fromStatus}</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-teal-700">{dec.toStatus}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatDateTime(dec.createdAt)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1.5">
                          <span className="text-slate-400">Actor:</span>
                          <span className="font-semibold text-slate-800">{dec.actor?.email || dec.actorId}</span>
                        </div>
                        {dec.reason && (
                          <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200 text-slate-700 leading-relaxed font-sans text-xs">
                            <span className="font-bold text-slate-500 block text-[10px] font-mono uppercase mb-0.5">Rationale:</span>
                            "{dec.reason}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>




      {/* Record Interview Result Modal */}
      <Dialog
        open={interviewOutcomeModalOpen}
        onClose={() => setInterviewOutcomeModalOpen(false)}
        title={
          app?.status === ApplicationStatus.FINAL_INTERVIEW
            ? "Record Client Final Evaluation"
            : "Record Interview Assessment"
        }
        description={
          app?.status === ApplicationStatus.FINAL_INTERVIEW
            ? `Record client evaluation decision for ${candidateName}`
            : `Record outcome for ${selectedInterviewForOutcome?.type?.replace(/_/g, " ") || "Initial Screening"}`
        }
      >
        <div className="space-y-4">
          <Select
            label={
              app?.status === ApplicationStatus.FINAL_INTERVIEW
                ? "Client Evaluation Decision / Result"
                : "Interview Outcome / Result"
            }
            value={interviewOutcomeResult}
            onChange={(e) => setInterviewOutcomeResult(e.target.value as "PASS" | "FAIL" | "NO_SHOW")}
            options={
              app?.status === ApplicationStatus.FINAL_INTERVIEW
                ? [
                    { value: "PASS", label: "PASS — Client Accepts / Selected for Hire" },
                    { value: "FAIL", label: "FAIL — Client Rejected Candidate" },
                    { value: "NO_SHOW", label: "NO SHOW — Candidate Did Not Attend Client Evaluation" },
                  ]
                : [
                    { value: "PASS", label: "PASS — Candidate Meets Technical & Behavioral Requirements" },
                    { value: "FAIL", label: "FAIL — Candidate Does Not Qualify" },
                    { value: "NO_SHOW", label: "NO SHOW — Candidate Did Not Attend (Auto-archive)" },
                  ]
            }
          />
          <Textarea
            label={
              app?.status === ApplicationStatus.FINAL_INTERVIEW
                ? "Client Feedback & Decision Notes"
                : "Evaluation Notes & Interviewer Remarks"
            }
            placeholder={
              app?.status === ApplicationStatus.FINAL_INTERVIEW
                ? "Document client interview feedback, agreed salary, or remarks"
                : "Document technical competencies, communication skills, or panel remarks"
            }
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
                const targetType =
                  selectedInterviewForOutcome?.type ||
                  (app?.status === ApplicationStatus.FINAL_INTERVIEW
                    ? InterviewType.FINAL_INTERVIEW
                    : InterviewType.INITIAL_SCREENING);
                updateInterviewStatusMutation.mutate({
                  interviewId: selectedInterviewForOutcome?.id,
                  type: targetType,
                  result: interviewOutcomeResult,
                  notes: interviewOutcomeNotes,
                });
              }}
            >
              {app?.status === ApplicationStatus.FINAL_INTERVIEW ? "Save Evaluation Result" : "Save Result"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Schedule / Reschedule Interview Modal */}
      <Dialog
        open={interviewModalOpen}
        onClose={() => setInterviewModalOpen(false)}
        title={
          interviewType === InterviewType.INITIAL_SCREENING
            ? (pendingScreeningInterview ? "Reschedule Initial Screening Interview" : "Schedule Initial Screening Interview")
            : (pendingFinalInterview ? "Reschedule Final Client Interview" : "Schedule Final Technical / Client Interview")
        }
        description={
          (interviewType === InterviewType.INITIAL_SCREENING ? pendingScreeningInterview : pendingFinalInterview)
            ? `Update scheduled date and time for ${candidateName}`
            : `Book ${interviewType === InterviewType.INITIAL_SCREENING ? "initial screening" : "final technical / client"} interview for ${candidateName}`
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
            <span className="text-slate-500 font-mono text-[10px] uppercase block">Interview Milestone:</span>
            <div className="font-bold font-mono text-slate-900 text-sm flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>
                {interviewType === InterviewType.INITIAL_SCREENING
                  ? "Initial Screening Interview"
                  : "Final Technical / Client Interview"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              7-Day Compliance SLA begins upon scheduling.
            </p>
          </div>
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
              {(interviewType === InterviewType.INITIAL_SCREENING ? pendingScreeningInterview : pendingFinalInterview)
                ? "Save Rescheduled Interview"
                : "Schedule Interview"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Client Endorse Modal */}
      <Dialog
        open={endorseModalOpen}
        onClose={() => setEndorseModalOpen(false)}
        title="Endorse Candidate to Client"
        description={`Forward ${candidateName} to client hiring team for evaluation`}
        overflowVisible
      >
        <div className="space-y-4">
          {linkedClientId ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1.5">
              <span className="text-slate-500 font-mono text-[10px] uppercase block">
                Target Client (Auto-Linked from Requisition MRF):
              </span>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-teal-600" />
                <span>{linkedClientName}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Position: {app.jobPosting?.title || "Specialist"}
                {app.jobPosting?.mrf?.title ? ` • MRF: ${app.jobPosting.mrf.title}` : ""}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <ComboBox
                label="Select Target Client Account"
                placeholder="Search verified corporate client..."
                leftIcon={<Building2 className="w-3.5 h-3.5 text-slate-400" />}
                value={manualClientId ? String(manualClientId) : ""}
                onChange={(val) => setManualClientId(Number(val) || null)}
                options={clients.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                  subtitle: `${c.industry || "General"} • ${c.address || "Philippines"}`,
                }))}
                helperText="Requisition is not linked to an MRF. Select client manually to proceed."
                required
              />
            </div>
          )}

          <Select
            label="Initial Endorsement Status"
            value={endorseOutcome}
            onChange={(e) => setEndorseOutcome(e.target.value as any)}
            options={[
              { value: "PENDING", label: "PENDING — Under Client Review" },
              { value: "APPROVED", label: "APPROVED — Client Accepted Candidate" },
              { value: "DECLINED", label: "DECLINED — Client Rejected Candidate" },
            ]}
          />
          <Textarea
            label="Endorsement Notes / Profile Summary"
            placeholder="Key screening strengths, communication skills, or coordinator remarks for client..."
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
              disabled={!(linkedClientId || manualClientId)}
              loading={endorseMutation.isPending}
              onClick={() => {
                const targetClientId = linkedClientId || manualClientId;
                if (!targetClientId) return;
                endorseMutation.mutate({
                  clientId: targetClientId,
                  outcome: endorseOutcome,
                  notes: endorseNotes || undefined,
                });
              }}
            >
              Submit Endorsement to Client
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Update Client Acceptance Modal */}
      <Dialog
        open={updateEndorsementModalOpen}
        onClose={() => setUpdateEndorsementModalOpen(false)}
        title="Record Client Acceptance"
        description={`Record evaluation feedback and acceptance status from ${selectedEndorsementClientName || linkedClientName}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1.5">
            <span className="text-slate-500 font-mono text-[10px] uppercase block">
              Target Client & Requisition:
            </span>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-teal-600" />
              <span>{selectedEndorsementClientName || linkedClientName}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Position: {app.jobPosting?.title || "Specialist"}
              {app.jobPosting?.mrf?.title ? ` • MRF: ${app.jobPosting.mrf.title}` : ""}
            </div>
          </div>

          <Select
            label="Client Acceptance Outcome"
            value={updateEndorsementOutcome}
            onChange={(e) => setUpdateEndorsementOutcome(e.target.value as any)}
            options={[
              { value: "PENDING", label: "PENDING — Under Client Review" },
              { value: "APPROVED", label: "APPROVED — Client Accepted Candidate" },
              { value: "DECLINED", label: "DECLINED — Client Rejected Candidate" },
            ]}
          />
          <Textarea
            label="Client Feedback / Evaluation Notes"
            placeholder="Feedback from client hiring manager regarding qualifications, technical fit, or interview schedule..."
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
              Save Client Acceptance
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add Custom Compliance Modal */}
      <Dialog
        open={complianceModalOpen}
        onClose={() => setComplianceModalOpen(false)}
        title="Add Custom Requirement"
        description="Assign an exceptional or role-specific clearance not covered by the standard requirements checklist."
        overflowVisible
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1.5">
            <span className="text-slate-500 font-mono text-[10px] uppercase block">
              Standard Requirements Checklist Notice:
            </span>
            <p className="text-slate-600">
              Government IDs, NBI Clearance, Medical Exam, SSS, PhilHealth, Pag-IBIG, and Contracts are auto-generated. Use this form only for unique role/client requirements.
            </p>
          </div>

          {/* Quick preset selector buttons */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Quick Presets / Templates</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Driver's License (Professional)",
                "PRC Board License",
                "5-Panel Drug Test Certificate",
                "Academic Transcript (TOR)",
                "Certificate of Employment (COE)",
                "Trade Skill Certification",
              ].map((preset) => {
                const isAlreadyAdded = (app.complianceRequirements || []).some(
                  (r) => r.documentLabel.toLowerCase().trim() === preset.toLowerCase().trim()
                );
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={isAlreadyAdded}
                    onClick={() => setComplianceDocLabel(preset)}
                    className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors ${
                      isAlreadyAdded
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through"
                        : complianceDocLabel === preset
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {preset} {isAlreadyAdded && "(Already Added)"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <ComboBox
              label="Document Label / Requirement Name"
              placeholder="Search standard requirement or type custom name..."
              value={complianceDocLabel}
              onChange={(val) => setComplianceDocLabel(val || "")}
              options={COMPLIANCE_201_PRESETS.map((p) => ({
                value: p.label,
                label: p.label,
                subtitle: p.description,
                badge: p.category,
                disabled: (app.complianceRequirements || []).some(
                  (r) => r.documentLabel.toLowerCase().trim() === p.label.toLowerCase().trim()
                ),
              }))}
              allowCustom
              required
            />
            {(() => {
              const trimmed = complianceDocLabel.trim().toLowerCase();
              const isDuplicate = (app.complianceRequirements || []).some(
                (r) => r.documentLabel.toLowerCase().trim() === trimmed
              );
              const hasBundleDelimiters = complianceDocLabel.includes(",") || complianceDocLabel.includes(";");

              if (isDuplicate) {
                return (
                  <p className="text-xs text-rose-600 font-mono mt-1">
                    ⚠️ This requirement already exists in the candidate's compliance checklist.
                  </p>
                );
              }
              if (hasBundleDelimiters) {
                return (
                  <p className="text-xs text-amber-600 font-mono mt-1">
                    ⚠️ Please enter a single document name rather than combining multiple items.
                  </p>
                );
              }
              return null;
            })()}
          </div>

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
              disabled={
                !complianceDocLabel.trim() ||
                (app.complianceRequirements || []).some(
                  (r) => r.documentLabel.toLowerCase().trim() === complianceDocLabel.trim().toLowerCase()
                ) ||
                complianceDocLabel.includes(",") ||
                complianceDocLabel.includes(";")
              }
              loading={addComplianceMutation.isPending}
              onClick={() =>
                addComplianceMutation.mutate({
                  documentLabel: complianceDocLabel.trim(),
                  deadline: complianceDeadline ? new Date(complianceDeadline).toISOString() : undefined,
                  isRequired: true,
                })
              }
            >
              Add Custom Requirement
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Compliance Deadline Modal */}
      <Dialog
        open={editDeadlineModalOpen}
        onClose={() => {
          setEditDeadlineModalOpen(false);
          setEditDeadlineReqId(null);
        }}
        title="Adjust Compliance Deadline"
        description="Set or extend the submission target date for this clearance requirement."
      >
        <div className="space-y-4">
          {(() => {
            const selectedReq = app.complianceRequirements?.find((r) => r.id === editDeadlineReqId);
            return (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                <span className="text-slate-400 font-mono text-[10px] uppercase block">Selected Requirement</span>
                <span className="font-bold text-slate-900 block">{selectedReq?.documentLabel}</span>
                {selectedReq?.deadline && (
                  <span className="text-slate-500 font-mono text-[11px] block">
                    Current Deadline: {formatDate(selectedReq.deadline)}
                  </span>
                )}
              </div>
            );
          })()}

          <Input
            label="Target Submission Deadline"
            type="date"
            value={editDeadlineDate}
            onChange={(e) => setEditDeadlineDate(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-500 font-mono uppercase block">Quick Extend SLA</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "+3 Days", days: 3 },
                { label: "+7 Days", days: 7 },
                { label: "+14 Days", days: 14 },
                { label: "+30 Days", days: 30 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + opt.days);
                    setEditDeadlineDate(d.toISOString().split("T")[0]);
                  }}
                  className="text-[11px] font-mono px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-300 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditDeadlineModalOpen(false);
                setEditDeadlineReqId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!editDeadlineDate || !editDeadlineReqId}
              loading={updateDeadlineMutation.isPending}
              onClick={() => {
                if (editDeadlineReqId) {
                  updateDeadlineMutation.mutate({
                    id: editDeadlineReqId,
                    deadline: editDeadlineDate ? new Date(editDeadlineDate).toISOString() : null,
                  });
                }
              }}
            >
              Save Deadline
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
                    <button
                      type="button"
                      onClick={() => {
                        setReviewReqId(null);
                        setPreviewDocState({
                          open: true,
                          documentId: selectedReq.documentId,
                          requirementId: selectedReq.id,
                          title: selectedReq.documentLabel,
                          requirementStatus: selectedReq.reviewStatus,
                        });
                      }}
                      className="inline-flex items-center gap-1 font-mono text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open / Inspect Uploaded Document
                    </button>
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
        fileUrl={previewDocState?.fileUrl}
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

      {/* Deploy Modal */}
      <Dialog
        open={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        title="Activate Workforce Site Deployment"
        description={`Deploy ${candidateName} to client work location`}
        overflowVisible
      >
        <div className="space-y-4">
          {linkedClientId ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1.5">
              <span className="text-slate-500 font-mono text-[10px] uppercase block">
                Assigned Client (Auto-Linked):
              </span>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-teal-600" />
                <span>{linkedClientName || `Client #${linkedClientId}`}</span>
              </div>
              {app.jobPosting?.title && (
                <div className="text-[11px] text-slate-500 font-mono">
                  Position: {app.jobPosting.title}
                  {app.jobPosting?.mrf?.title ? ` • MRF: ${app.jobPosting.mrf.title}` : ""}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <ComboBox
                label="Select Target Client Account *"
                placeholder="Search verified corporate client..."
                leftIcon={<Building2 className="w-3.5 h-3.5 text-slate-400" />}
                value={deployClientId ? String(deployClientId) : ""}
                onChange={(val) => setDeployClientId(Number(val) || 0)}
                options={clients.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                  subtitle: `${c.industry || "General"} • ${c.address || "Philippines"}`,
                }))}
                helperText="Requisition is not linked to an MRF client. Select client manually to activate deployment."
                required
              />
            </div>
          )}

          <ComboBox
            label="Deployment Site / Location"
            placeholder="Select inherited site or specify custom location..."
            value={deploySite}
            onChange={(val) => setDeploySite(val || "")}
            options={Array.from(
              new Set(
                [
                  (app.jobPosting?.mrf as any)?.location,
                  app.jobPosting?.location,
                  (linkedClient as any)?.address,
                  clients.find((c) => c.id === (linkedClientId || deployClientId))?.address,
                ].filter(Boolean) as string[]
              )
            ).map((loc) => ({
              value: loc,
              label: loc,
              subtitle: loc === (app.jobPosting?.mrf as any)?.location ? "Inherited from MRF" : "Corporate Facility",
            }))}
            allowCustom
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contract Start Date (Optional)"
              type="date"
              value={deployContractStart}
              onChange={(e) => setDeployContractStart(e.target.value)}
            />
            <Input
              label="Contract End Date (Optional)"
              type="date"
              value={deployContractEnd}
              onChange={(e) => setDeployContractEnd(e.target.value)}
            />
          </div>

          <Textarea
            label="Deployment Notes / Shift Instructions (Optional)"
            placeholder="Shift assignment, site supervisor, reporting instructions..."
            value={deployNotes}
            onChange={(e) => setDeployNotes(e.target.value)}
            rows={2}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setDeployModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!(linkedClientId || deployClientId) || deployMutation.isPending}
              loading={deployMutation.isPending}
              onClick={() => {
                const targetClientId = linkedClientId || deployClientId;
                if (!targetClientId) {
                  notify.error("Client Required", "Please select a target client for this deployment.");
                  return;
                }
                deployMutation.mutate({
                  clientId: targetClientId,
                  site: deploySite || undefined,
                  contractStart: deployContractStart ? new Date(deployContractStart).toISOString() : undefined,
                  contractEnd: deployContractEnd ? new Date(deployContractEnd).toISOString() : undefined,
                  notes: deployNotes || undefined,
                });
              }}
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
              { value: "Failed Compliance Verification", label: "Failed Requirements Verification / Derogatory Record" },
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

      {/* Record Contract Signing Modal */}
      <Dialog
        open={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
        title="Record Employment Contract Signing"
        description={`Record signed employment contract for ${candidateName}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1 font-mono">
            <div className="text-slate-600">Candidate: <strong className="text-slate-900">{candidateName}</strong></div>
            <div className="text-slate-600">Position: <strong className="text-slate-900">{app.jobPosting?.title || "Specialist"}</strong></div>
            <div className="text-slate-600">Client: <strong className="text-slate-900">{linkedClientName || "Direct / Internal"}</strong></div>
          </div>
          <Input
            label="Contract Document URL / Storage Reference (Optional)"
            placeholder="https://... or storage reference..."
            value={contractDocumentUrl}
            onChange={(e) => setContractDocumentUrl(e.target.value)}
          />
          <Textarea
            label="Contract Notes / Remarks (Optional)"
            placeholder="Contract terms, duration, compensation acknowledgment, or witness details..."
            value={contractNotes}
            onChange={(e) => setContractNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setContractModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={signContractMutation.isPending}
              onClick={() =>
                signContractMutation.mutate({
                  contractNotes: contractNotes.trim() || undefined,
                  contractDocumentUrl: contractDocumentUrl.trim() || undefined,
                })
              }
            >
              Confirm Contract Signed
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Record Corporate Orientation Modal */}
      <Dialog
        open={orientationModalOpen}
        onClose={() => setOrientationModalOpen(false)}
        title="Record Corporate Orientation"
        description={`Record company policy briefing and job site orientation for ${candidateName}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1 font-mono">
            <div className="text-slate-600">Candidate: <strong className="text-slate-900">{candidateName}</strong></div>
            <div className="text-slate-600">Assigned Site: <strong className="text-slate-900">{app.jobPosting?.location || "Main Site"}</strong></div>
          </div>
          <Input
            label="Orientation Date"
            type="date"
            value={orientationDate}
            onChange={(e) => setOrientationDate(e.target.value)}
            required
          />
          <Textarea
            label="Orientation Notes / Topics Covered (Optional)"
            placeholder="Company policies, site safety protocols, dress code, reporting supervisor briefed..."
            value={orientationNotes}
            onChange={(e) => setOrientationNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setOrientationModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={completeOrientationMutation.isPending}
              onClick={() =>
                completeOrientationMutation.mutate({
                  orientationDate: orientationDate ? new Date(orientationDate).toISOString() : undefined,
                  orientationNotes: orientationNotes.trim() || undefined,
                })
              }
            >
              Record Orientation
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
