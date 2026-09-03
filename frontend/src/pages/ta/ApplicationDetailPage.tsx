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
import { Button, Dialog, Input, Select, Textarea, ComboBox } from "../../components/ui";
import { formatDate, formatDateTime, getApplicationStatusMeta, extractDocumentId } from "../../lib/utils";
import { COMPLIANCE_201_PRESETS } from "../../lib/hr-constants";
import {
  ApplicationStatus,
  InterviewType,
} from "../../lib/types/enums";
import type { Interview } from "../../lib/types/application.types";
import {
  User,
  Award,
  RefreshCw,
  Users,
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
  UserX,
  CheckCircle2,
  AlertCircle,
  Eye,
  XCircle,
  FileCheck,
} from "lucide-react";
import { notify } from "../../lib/feedback";



type TabKey =
  | "overview"
  | "ai-score"
  | "resume"
  | "interviews"
  | "endorsements"
  | "compliance"
  | "timeline"
  | "hiring"
  | "similar";

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
    "similar",
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
    title?: string;
    requirementId?: number | null;
    requirementStatus?: string;
  } | null>(null);

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

  const similarCandidatesQuery = useQuery({
    queryKey: ["ta", "application", applicationId, "similar"],
    queryFn: () => taApi.getSimilarCandidates(applicationId),
    enabled: activeTab === "similar" && Boolean(applicationId),
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

  const isContractAndOrientationStage = app.status === ApplicationStatus.CONTRACT_AND_ORIENTATION;
  const isContractSigned = Boolean(app.contractSigned);
  const isOrientationCompleted = Boolean(app.orientationCompleted);
  const isReadyForDeployment =
    (isContractAndOrientationStage || isComplianceStage) &&
    !hasUnapprovedMandatoryCompliance &&
    isContractSigned &&
    isOrientationCompleted &&
    !isTerminal;
  const canDeployCandidate = isReadyForDeployment;

  const totalCompReqs = app.complianceRequirements?.length || 0;
  const approvedCompReqs = (app.complianceRequirements || []).filter((r) => r.reviewStatus === "APPROVED").length;
  const submittedCompReqs = (app.complianceRequirements || []).filter((r) => r.reviewStatus === "SUBMITTED").length;
  const missingCompReqs = (app.complianceRequirements || []).filter((r) => !r.documentId && r.reviewStatus !== "APPROVED").length;

  const tabs: { id: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "overview", label: "Candidate Profile", icon: User },
    { id: "ai-score", label: "Candidate Assessment", icon: Award },
    { id: "resume", label: "Resume & Documents", icon: FileText },
    { id: "interviews", label: `Interviews (${app.interviews?.length || 0})`, icon: Calendar },
    { id: "endorsements", label: `Endorsements (${app.clientEndorsements?.length || 0})`, icon: Building2 },
    { id: "compliance", label: `Requirements (${app.complianceRequirements?.length || 0})`, icon: ShieldCheck },
    { id: "timeline", label: `Decision Audit (${decisions.length})`, icon: History },
    { id: "hiring", label: "Personnel & Deployment", icon: Truck },
    { id: "similar", label: "Similar in Pool", icon: Users },
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
      <div className="bg-white border border-slate-300 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                Pipeline Status:
              </span>
              <StatusBadge status={app.status} size="sm" />
              <ScoreBadge score={scores?.finalFitScore ?? app.candidateFitScore ?? app.aiScore} size="md" />
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Submitted: {formatDate(app.createdAt)} • Email: {app.user?.email} • Phone: {profile?.mobileNumber || "N/A"}
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
                {isReadyForDeployment && activeTab !== "hiring" && (
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
                {!isReadyForDeployment && activeTab !== "hiring" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("hiring")}
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
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-3.5 sm:p-6">
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
                      <FileCheck className="w-4 h-4 text-teal-800" />
                      <h4 className="text-xs font-bold font-mono text-teal-950 uppercase tracking-wide">
                        Candidate Assessment & Recommendation
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-white text-teal-900 border border-slate-300">
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
          )}

          {/* TAB 3: RESUME & DOCUMENTS */}
          {activeTab === "resume" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Curriculum Vitae & Document Vault</h3>
                <p className="text-xs text-slate-500">
                  Candidate resumes and uploaded requirements verification files
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
                      <button
                        type="button"
                        onClick={() => {
                          const docId = extractDocumentId(app.resumeUrl || profile?.resumeUrl);
                          setPreviewDocState({
                            open: true,
                            documentId: docId,
                            title: "Application Resume (CV)",
                          });
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Resume (PDF)</span>
                      </button>
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
                      <button
                        type="button"
                        onClick={() => {
                          const docId = extractDocumentId(profile.photoUrl);
                          setPreviewDocState({
                            open: true,
                            documentId: docId,
                            title: "Identification Photo",
                          });
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Inspect Full Photo</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No profile photo on file.</p>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: INTERVIEWS */}
          {activeTab === "interviews" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-900">Scheduled Interviews</h3>
                  <p className="text-xs text-slate-500">
                    Track candidate interviews, evaluate outcomes, and log recruiter feedback
                  </p>
                </div>
              </div>

              {!app.interviews || app.interviews.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No interviews scheduled yet. Click "Schedule Interview" in the stage banner above to initiate candidate assessment.
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
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
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

          {/* TAB 6: REQUIREMENTS CHECKLIST */}
          {activeTab === "compliance" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Pre-Employment Requirements Checklist</h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                      Auto-Generated
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Standard statutory clearances (NBI, SSS, PhilHealth, Pag-IBIG, Medical, Contract) required before field deployment
                  </p>
                </div>
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
                  Add Custom Requirement
                </Button>
              </div>

              {/* Compliance Status Progress Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs font-mono">
                <div className="space-y-0.5">
                  <span className="text-slate-400 uppercase text-[10px] block">Total Required</span>
                  <span className="text-sm font-bold text-slate-900">{totalCompReqs} Documents</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-emerald-600 uppercase text-[10px] block">Approved</span>
                  <span className="text-sm font-bold text-emerald-700">{approvedCompReqs} / {totalCompReqs}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-blue-600 uppercase text-[10px] block">Under Review</span>
                  <span className="text-sm font-bold text-blue-700">{submittedCompReqs}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-amber-600 uppercase text-[10px] block">Awaiting Upload</span>
                  <span className="text-sm font-bold text-amber-700">{missingCompReqs}</span>
                </div>
              </div>

              {!app.complianceRequirements || app.complianceRequirements.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No compliance requirements generated yet. Standard checklist is created automatically upon hiring.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {app.complianceRequirements.map((req) => (
                    <div key={req.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{req.documentLabel}</span>
                          {req.isRequired && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              MANDATORY
                            </span>
                          )}
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            req.reviewStatus === "APPROVED" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" :
                            req.reviewStatus === "REJECTED" ? "bg-rose-50 text-rose-800 border border-rose-200" :
                            req.reviewStatus === "SUBMITTED" ? "bg-blue-50 text-blue-800 border border-blue-200" :
                            "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            {req.reviewStatus === "SUBMITTED" ? "UNDER REVIEW" : req.reviewStatus}
                          </span>
                        </div>
                        {(() => {
                          const now = new Date();
                          const deadlineDate = req.deadline ? new Date(req.deadline) : null;
                          const isOverdue = deadlineDate && deadlineDate < now && req.reviewStatus !== "APPROVED";
                          const diffDays = deadlineDate ? Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                          const isDueSoon = diffDays !== null && diffDays >= 0 && diffDays <= 3 && req.reviewStatus !== "APPROVED";

                          if (!deadlineDate) {
                            return (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                                <span>No deadline set</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditDeadlineReqId(req.id);
                                    setEditDeadlineDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
                                    setEditDeadlineModalOpen(true);
                                  }}
                                  className="text-teal-600 hover:underline text-[10px] ml-1 cursor-pointer font-sans"
                                >
                                  + Set Deadline
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-mono">
                              <span className={isOverdue ? "text-rose-600 font-bold" : isDueSoon ? "text-amber-700 font-bold" : "text-slate-500"}>
                                Deadline: {formatDate(req.deadline)}
                              </span>
                              {isOverdue && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                  OVERDUE
                                </span>
                              )}
                              {isDueSoon && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
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
                                className="text-slate-400 hover:text-teal-600 text-[10px] underline ml-1 cursor-pointer font-sans"
                                title="Adjust or extend deadline"
                              >
                                Edit
                              </button>
                            </div>
                          );
                        })()}
                        {req.reviewNotes && <p className="text-xs text-slate-500 italic">Reviewer note: {req.reviewNotes}</p>}
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
                            <span className="text-[11px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Awaiting Upload
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
                              Review
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

          {/* TAB 8: PERSONNEL & DEPLOYMENT */}
          {activeTab === "hiring" && (
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
              onOpenComplianceTab={() => setActiveTab("compliance")}
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
          )}

          {/* TAB 9: SIMILAR CANDIDATES IN TALENT POOL */}
          {activeTab === "similar" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Similar Talent Pool Candidates</h3>
                  <p className="text-xs text-slate-500">
                    Pre-screened and archived talent with matching skills and qualifications
                  </p>
                </div>
                <Link to="/ta/talent-pool">
                  <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3 h-3" />}>
                    Open Talent Pool
                  </Button>
                </Link>
              </div>

              {similarCandidatesQuery.isLoading ? (
                <LoadingState variant="cards" />
              ) : similarCandidatesQuery.isError ? (
                <ErrorState error={similarCandidatesQuery.error} onRetry={() => similarCandidatesQuery.refetch()} />
              ) : (similarCandidatesQuery.data || []).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
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
                        className="p-4 rounded-xl border border-slate-200 hover:border-teal-300 transition-colors bg-white flex flex-col justify-between space-y-3 shadow-xs"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-900">
                                  {c.firstName} {c.lastName}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                  {c.availability}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">
                                {c.email}
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-200 text-xs font-mono font-bold">
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
                                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold"
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

      {/* Record Candidate Orientation Modal */}
      <Dialog
        open={orientationModalOpen}
        onClose={() => setOrientationModalOpen(false)}
        title="Record Candidate Orientation"
        description={`Record company and site onboarding orientation for ${candidateName}`}
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
              Confirm Orientation Completed
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
