import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
import { notify, formatErrorMessage } from "../../../lib/feedback";
import { getApplicationStatusMeta } from "../../../lib/utils";
import { ApplicationStatus, InterviewType } from "../../../lib/types/enums";
import type { ReviewComplianceDto } from "../../../lib/types/ta.types";
import type { CloseSubmission } from "../CloseApplicationDialog";
import { interviewOutcomeNextStep, interviewOutcomeWord } from "../InterviewOutcomeDialog";

export type RecordFeedback = { type: "success" | "error"; message: string } | null;

interface Options {
  applicationId: string;
  status?: ApplicationStatus;
  candidateName: string;
}

/**
 * Every write the application record can make, with the same payloads, cache updates and messages
 * the page used before it was split. Dialogs close themselves through the per-call `onSuccess` option.
 */
export function useApplicationMutations({ applicationId, status, candidateName }: Options) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<RecordFeedback>(null);

  const recordKey = ["ta", "application", applicationId] as const;
  const decisionsKey = ["ta", "application", applicationId, "decisions"] as const;

  const setListStatus = (patch: (item: any) => any) => {
    queryClient.setQueriesData<any>({ queryKey: ["ta", "applications"] }, (old: any) => {
      if (!old) return old;
      if (Array.isArray(old)) return old.map((item) => (String(item.id) === String(applicationId) ? patch(item) : item));
      if (Array.isArray(old.data)) {
        return { ...old, data: old.data.map((item: any) => (String(item.id) === String(applicationId) ? patch(item) : item)) };
      }
      return old;
    });
  };

  // Every view that shows an application's stage: the record, its history, the lists and stage counts,
  // dashboard and sidebar counts, interviews, requirements, deployments and the redeployment queue.
  const refreshApplicationQueries = () => {
    queryClient.invalidateQueries({ queryKey: recordKey });
    queryClient.invalidateQueries({ queryKey: decisionsKey });
    queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
    queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
    queryClient.invalidateQueries({ queryKey: ["ta", "compliance"] });
    queryClient.invalidateQueries({ queryKey: ["ta", "jobs"] });
    queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
    queryClient.invalidateQueries({ queryKey: ["ta", "redeployment-queue"] });
  };

  const updateStatus = useMutation({
    mutationFn: (data: { status: ApplicationStatus; reason?: string }) => taApi.updateApplicationStatus(applicationId, data),
    onSuccess: (_, vars) => {
      queryClient.setQueryData<any>(recordKey, (old: any) => (old ? { ...old, status: vars.status } : old));
      setListStatus((item) => ({ ...item, status: vars.status }));
      refreshApplicationQueries();
      const msg = `Candidate stage moved to ${getApplicationStatusMeta(vars.status).label}.`;
      setFeedback({ type: "success", message: msg });
      notify.success("Stage updated", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to update the candidate’s stage. " + formatErrorMessage(err) });
      notify.error("Unable to update stage", err);
    },
  });

  const close = useMutation({
    mutationFn: (data: CloseSubmission) => taApi.closeApplication(applicationId, data),
    onSuccess: (_, vars) => {
      const message = vars.outcome === "REJECTED" ? "Applicant rejected" : "Marked as backed out";
      setFeedback({ type: "success", message });
      notify.success(message);
      refreshApplicationQueries();
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to close this application. " + formatErrorMessage(err) });
      notify.error("Unable to close application", err);
    },
  });

  // Optional printable copy with the name, position and start date filled in; the rate is written by hand.
  const downloadContract = useMutation({
    mutationFn: (startDate: string) => taApi.downloadContractPdf(applicationId, startDate),
    onSuccess: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `MEGS-Contract-${candidateName.replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to prepare the printable contract. " + formatErrorMessage(err) });
      notify.error("Unable to prepare contract", err);
    },
  });

  // Confirming the signed contract records it and deploys the candidate (no file is sent).
  const deployAfterContractSigning = useMutation({
    mutationFn: (data: { startDate: string }) => taApi.deployAfterContractSigning(applicationId, data),
    onSuccess: () => {
      refreshApplicationQueries();
      setFeedback({
        type: "success",
        message: "The candidate is deployed. Confirm the first day on the deployment record.",
      });
      notify.success("Applicant deployed", "The contract is confirmed and the candidate is deployed.");
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to deploy the applicant. " + formatErrorMessage(err) });
      notify.error("Unable to deploy applicant", err);
    },
  });

  const updateInterviewStatus = useMutation({
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
      }
      return taApi.recordInterviewDirectly(applicationId, {
        type:
          data.type ||
          (status === ApplicationStatus.FINAL_INTERVIEW ? InterviewType.FINAL_INTERVIEW : InterviewType.INITIAL_SCREENING),
        result: data.result,
        notes: data.notes,
        conductedAt: data.conductedAt || new Date().toISOString(),
      });
    },
    onSuccess: (updatedInterview: any, vars) => {
      queryClient.setQueryData<any>(recordKey, (old: any) => {
        if (!old) return old;
        const newStatus = vars.result === "NO_SHOW" ? ApplicationStatus.ARCHIVED : old.status;
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
      if (vars.result === "NO_SHOW") {
        setListStatus((item) => ({ ...item, status: ApplicationStatus.ARCHIVED, isArchived: true }));
      }
      refreshApplicationQueries();
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      const msg = `Interview outcome saved as ${interviewOutcomeWord(vars.result)}. ${interviewOutcomeNextStep(
        vars.result,
        vars.type ? vars.type === InterviewType.FINAL_INTERVIEW : status === ApplicationStatus.FINAL_INTERVIEW
      )}`;
      setFeedback({ type: "success", message: msg });
      notify.success("Interview outcome saved", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to save the interview outcome. Please try again." });
      notify.error("Unable to save interview outcome", err);
    },
  });

  const [analysisRunId, setAnalysisRunId] = useState(0);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  // Runs once when the analysis dialog sees the job finish, even if the dialog was hidden.
  const handleAnalysisFinished = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
  }, [queryClient, applicationId]);
  const analyze = useMutation({
    mutationFn: () => taApi.analyzeApplication(applicationId),
    onSuccess: () => {
      setAnalysisRunId(Date.now());
      setAnalysisDialogOpen(true);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: `Unable to refresh the candidate assessment. ${formatErrorMessage(err)}` });
      notify.error("Unable to refresh assessment", err);
    },
  });

  const scheduleInterview = useMutation({
    mutationFn: (data: { type: InterviewType; scheduledAt: string; location?: string }) =>
      taApi.scheduleInterview(applicationId, data),
    onSuccess: () => {
      refreshApplicationQueries();
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      const msg = "Interview scheduled successfully.";
      setFeedback({ type: "success", message: msg });
      notify.success("Interview scheduled", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: `Unable to schedule the interview. ${formatErrorMessage(err)}` });
      notify.error("Unable to schedule interview", err);
    },
  });

  const scheduleContractSigning = useMutation({
    mutationFn: (data: { scheduledAt: string; location: string }) => taApi.scheduleContractSigning(applicationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordKey });
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      const msg = "Contract signing scheduled. The applicant was notified.";
      setFeedback({ type: "success", message: msg });
      notify.success("Contract signing scheduled", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: `Unable to schedule the contract signing. ${formatErrorMessage(err)}` });
      notify.error("Unable to schedule contract signing", err);
    },
  });

  const refreshAfterReschedule = () => {
    refreshApplicationQueries();
    queryClient.invalidateQueries({ queryKey: ["applicant"] });
  };

  const approveReschedule = useMutation({
    mutationFn: (data: { requestId: number; scheduledAt: string; location?: string }) =>
      taApi.approveRescheduleRequest(applicationId, data.requestId, { scheduledAt: data.scheduledAt, location: data.location }),
    onSuccess: () => {
      refreshAfterReschedule();
      const msg = "The new time was saved and the applicant was notified.";
      setFeedback({ type: "success", message: msg });
      notify.success("Reschedule approved", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: `Unable to approve the reschedule. ${formatErrorMessage(err)}` });
      notify.error("Unable to approve reschedule", err);
    },
  });

  const rejectReschedule = useMutation({
    mutationFn: (data: { requestId: number; decisionNote?: string }) =>
      taApi.rejectRescheduleRequest(applicationId, data.requestId, { decisionNote: data.decisionNote }),
    onSuccess: () => {
      refreshAfterReschedule();
      const msg = "The request was declined and the applicant was notified.";
      setFeedback({ type: "success", message: msg });
      notify.success("Reschedule declined", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: `Unable to decline the reschedule. ${formatErrorMessage(err)}` });
      notify.error("Unable to decline reschedule", err);
    },
  });

  const endorse = useMutation({
    mutationFn: (data: { clientId: number; outcome?: "PENDING" | "APPROVED" | "DECLINED" | "ENDORSED"; notes?: string }) =>
      taApi.recordEndorsement(applicationId, data),
    onSuccess: () => {
      queryClient.setQueryData<any>(recordKey, (old: any) =>
        old ? { ...old, status: ApplicationStatus.CLIENT_ENDORSEMENT } : old
      );
      setListStatus((item) => ({ ...item, status: ApplicationStatus.CLIENT_ENDORSEMENT }));
      refreshApplicationQueries();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const msg = "The candidate was sent to the client for review.";
      setFeedback({ type: "success", message: msg });
      notify.success("Candidate sent to client", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to send the candidate to the client. Please try again." });
      notify.error("Unable to send candidate", err);
    },
  });

  const updateEndorsement = useMutation({
    mutationFn: (data: { endorsementId: number; outcome: "PENDING" | "APPROVED" | "DECLINED" | "ENDORSED"; notes?: string }) =>
      taApi.updateEndorsement(applicationId, data.endorsementId, { outcome: data.outcome, notes: data.notes }),
    onSuccess: (_data: any, vars) => {
      queryClient.setQueryData<any>(recordKey, (old: any) => {
        if (!old) return old;
        const updated = (old.clientEndorsements || []).map((e: any) =>
          e.id === vars.endorsementId ? { ...e, outcome: vars.outcome, decisionNotes: vars.notes } : e
        );
        return { ...old, clientEndorsements: updated };
      });
      refreshApplicationQueries();
      const outcomeLabel =
        vars.outcome === "APPROVED"
          ? "Approved by client"
          : vars.outcome === "DECLINED"
          ? "Declined by client"
          : "Waiting for client review";
      const msg = `Client decision saved: ${outcomeLabel}.`;
      setFeedback({ type: "success", message: msg });
      notify.success("Client decision saved", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to save the client decision. Please try again." });
      notify.error("Unable to save client decision", err);
    },
  });

  const addRequirement = useMutation({
    mutationFn: (data: { documentLabel: string; deadline?: string; isRequired?: boolean }) =>
      taApi.createComplianceRequirement(applicationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordKey });
      const msg = "The requirement was added.";
      setFeedback({ type: "success", message: msg });
      notify.success("Requirement added", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: `Unable to add the requirement. ${formatErrorMessage(err)}` });
      notify.error("Unable to add requirement", err);
    },
  });

  const reviewRequirement = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReviewComplianceDto }) => taApi.reviewComplianceRequirement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordKey });
      const msg = "The requirement review was saved.";
      setFeedback({ type: "success", message: msg });
      notify.success("Review saved", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: `Unable to save the requirement review. ${formatErrorMessage(err)}` });
      notify.error("Unable to save review", err);
    },
  });

  const deleteRequirement = useMutation({
    mutationFn: (requirementId: number) => taApi.deleteComplianceRequirement(requirementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordKey });
      const msg = "Compliance requirement deleted successfully.";
      setFeedback({ type: "success", message: msg });
      notify.success("Requirement removed", msg);
    },
    onError: (err: any) => {
      const msg = formatErrorMessage(err) || "Unable to delete requirement. Please try again.";
      setFeedback({ type: "error", message: msg });
      notify.error("Unable to delete requirement", err);
    },
  });

  const updateDeadline = useMutation({
    mutationFn: ({ id, deadline }: { id: number; deadline: string | null }) =>
      taApi.updateComplianceRequirementDeadline(id, deadline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordKey });
      const msg = "The requirement deadline was updated.";
      setFeedback({ type: "success", message: msg });
      notify.success("Deadline updated", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: `Unable to update the deadline. ${formatErrorMessage(err)}` });
      notify.error("Unable to update deadline", err);
    },
  });

  const fastTrack = useMutation({
    mutationFn: (data?: { targetStage?: "FINAL_INTERVIEW" | "COMPLIANCE" }) => taApi.fastTrackRedeployment(applicationId, data),
    onSuccess: (res: any, vars) => {
      const carriedCount = res?.carriedOverDocuments?.length ?? 0;
      const targetLabel = (vars?.targetStage ?? "COMPLIANCE") === "FINAL_INTERVIEW" ? "Final interview" : "Requirements";
      const msg = `Candidate advanced to ${targetLabel}; ${carriedCount} valid clearance document${carriedCount === 1 ? "" : "s"} carried over.`;
      setFeedback({ type: "success", message: msg });
      notify.success("Redeployment fast-tracked", msg);
      refreshApplicationQueries();
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: `Unable to fast-track this redeployment. ${formatErrorMessage(err)}` });
      notify.error("Fast-track failed", err);
    },
  });

  const deploy = useMutation({
    mutationFn: (data: { clientId: number; site?: string; contractStart?: string; contractEnd?: string; notes?: string }) =>
      taApi.createDeployment(applicationId, data),
    onSuccess: (createdDeployment: any) => {
      queryClient.setQueryData<any>(recordKey, (old: any) =>
        old
          ? { ...old, deployments: createdDeployment ? [createdDeployment, ...(old.deployments || [])] : old.deployments }
          : old
      );
      refreshApplicationQueries();
      const msg = "The employee was assigned to the client site.";
      setFeedback({ type: "success", message: msg });
      notify.success("Deployment activated", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: `Unable to activate this deployment. ${formatErrorMessage(err)}` });
      notify.error("Unable to activate deployment", err);
    },
  });

  return {
    feedback,
    setFeedback,
    updateStatus,
    close,
    downloadContract,
    deployAfterContractSigning,
    updateInterviewStatus,
    analyze,
    analysis: { runId: analysisRunId, open: analysisDialogOpen, setOpen: setAnalysisDialogOpen, onFinished: handleAnalysisFinished },
    scheduleInterview,
    scheduleContractSigning,
    approveReschedule,
    rejectReschedule,
    endorse,
    updateEndorsement,
    addRequirement,
    reviewRequirement,
    deleteRequirement,
    updateDeadline,
    fastTrack,
    deploy,
  };
}

export type ApplicationMutations = ReturnType<typeof useApplicationMutations>;
