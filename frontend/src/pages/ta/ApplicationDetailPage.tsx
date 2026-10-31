import React, { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { taApplicationDecisionsQuery, taApplicationDetailQuery, taClientsQuery } from "../../lib/api/ta.queries";
import { useLiveStreamConnected } from "../../lib/live-stream-status";
import { PageHeader, LoadingState, ErrorState, DocumentPreviewModal, Tabs, ConfirmDialog, DetailLayout } from "../../components/common";
import type { ActionMenuItem } from "../../components/common";
import { Button, manilaIsoToDateTimeLocal } from "../../components/ui";
import { OnboardingDeploymentStepper } from "../../components/ta/OnboardingDeploymentStepper";
import { ResumeAnalysisDialog } from "../../components/ta/ResumeAnalysisDialog";
import { parseCandidateAssessment } from "../../components/ta/CandidateAssessmentPanel";
import { CloseApplicationDialog } from "../../components/ta/CloseApplicationDialog";
import { InterviewOutcomeDialog } from "../../components/ta/InterviewOutcomeDialog";
import { RequirementReviewDialog } from "../../components/ta/RequirementReviewDialog";
import { RequirementDocumentPreview } from "../../components/ta/compliance/RequirementDocumentPreview";
import { DocumentUpdateRequestDialog } from "../../components/ta/DocumentUpdateRequestDialog";
import { ApplicationSummary } from "../../components/ta/application/ApplicationSummary";
import { InterviewsTab } from "../../components/ta/application/InterviewsTab";
import { StageBar } from "../../components/ta/application/StageBar";
import { ProfileTab } from "../../components/ta/application/ProfileTab";
import { RequirementsTab } from "../../components/ta/application/RequirementsTab";
import { ActivityTab } from "../../components/ta/application/ActivityTab";
import { PersonalDetails } from "../../components/ta/application/PersonalDetails";
import { BioDataReviewPanel } from "../../components/ta/application/BioDataReviewPanel";
import { resumeProposalKey, resumeReadState, useResumeParseState } from "../../components/ta/application/useResumeParseState";
import { taProfileReviewApi } from "../../lib/api/ta-profile-review.api";
import { countActionable } from "../../lib/resume-autofill";
import { ResumeRail, ResumeDockTab, ResumeDrawerButton } from "../../components/ta/application/ResumePanel";
import { PipelineIndicator } from "../../components/common/PipelineIndicator";
import { APPLICATION_TAB_LABELS, defaultApplicationTab, normalizeApplicationTab, type ApplicationTab } from "../../components/ta/application/tabs";
import { daysInStage, overdueInterviewCount, summarizeInterview } from "../../components/ta/application/summary";
import { useIsDesktop } from "../../components/ta/application/useIsDesktop";
import { ScheduleInterviewDialog, type ScheduleActivity } from "../../components/ta/application/ScheduleInterviewDialog";
import { RescheduleRequestNotice, DeclineRescheduleDialog } from "../../components/ta/application/RescheduleRequestNotice";
import { SendToClientDialog, ClientDecisionDialog } from "../../components/ta/application/ClientReviewDialogs";
import { AddRequirementDialog, EditDeadlineDialog } from "../../components/ta/application/RequirementDialogs";
import { SkipToFinalDialog, FastTrackDialog } from "../../components/ta/application/StageDialogs";
import { ActivateDeploymentDialog, SignedContractDialog } from "../../components/ta/application/DeploymentDialogs";
import { deriveApplicationFlags, pickStageBarActions, type StageActionId } from "../../components/ta/application/stage-actions";
import { getNextStep } from "../../components/ta/application/next-step";
import { buildActivity } from "../../components/ta/application/activity";
import { useApplicationMutations } from "../../components/ta/application/useApplicationMutations";
import type { RequirementRowData } from "../../components/ta/application/RequirementRow";
import { CLOSURE_DISPOSITION_LABELS, CLOSURE_OUTCOME_LABELS, closureReasonLabel, type ClosureOutcome } from "../../lib/backout";
import { formatDate, extractDocumentId, displayEmail } from "../../lib/utils";
import { ApplicationStatus, InterviewType } from "../../lib/types/enums";
import type { Interview, RescheduleRequest } from "../../lib/types/application.types";
import type { ReviewComplianceDto } from "../../lib/types/ta.types";
import { notify } from "../../lib/feedback";
import { SourceChip } from "../../components/ta/walk-in/SourceChip";
import type { WalkInSlip } from "../../lib/types/application.types";
import type { TAApplicationSearch } from "../../routes";
import { TA_COPY, formatTaStatus } from "../../lib/ta-copy";
import { addManilaCalendarDays, getManilaToday } from "../../lib/field-limits";

type DialogState =
  | null
  | {
      kind: "schedule";
      type: ScheduleActivity;
      isReschedule: boolean;
      initialDate: string;
      /** The schedule being replaced, marked on the calendar. */
      currentDate?: string;
      initialLocation: string;
      /** Set when the recruiter is answering an applicant's reschedule request. */
      requestId?: number;
    }
  | { kind: "declineReschedule"; request: RescheduleRequest }
  | { kind: "outcome"; interview: Interview | null; type: InterviewType }
  | { kind: "sendToClient"; mode: "send" | "record" }
  | {
      kind: "clientDecision";
      endorsementId: number;
      clientName: string;
      initialOutcome: "" | "PENDING" | "APPROVED" | "DECLINED";
      initialNotes: string;
      priorNote: { notes: string; date: string } | null;
    }
  | { kind: "addRequirement" }
  | { kind: "editDeadline"; requirementId: number; initialDate: string }
  | { kind: "review"; requirementId: number }
  | { kind: "updateCopy"; target: { id: number; label: string } }
  | { kind: "removeRequirement"; target: { id: number; label: string } }
  | { kind: "skip" }
  | { kind: "fastTrack" }
  | { kind: "deploy" }
  | { kind: "contract" }
  | { kind: "confirmSigned" }
  | { kind: "close"; outcome: ClosureOutcome; contractNotSigned?: boolean };

const WalkInSlipDialog = lazy(() =>
  import("../../components/ta/walk-in/WalkInSlipDialog").then((m) => ({ default: m.WalkInSlipDialog })));

const getRouteSearch = (): TAApplicationSearch => {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const number = (value: string | null) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  };
  return {
    q: params.get("q") || undefined,
    stage: (params.get("stage") as TAApplicationSearch["stage"]) || undefined,
    clientId: number(params.get("clientId")),
    jobId: number(params.get("jobId")),
    archived: params.get("archived") === "true" || params.get("archived") === "1" ? true : undefined,
    page: number(params.get("page")),
  };
};

export const ApplicationDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { applicationId } = useParams({ strict: false }) as { applicationId: string };

  // The list filters the recruiter came from travel with the Back link.
  const listSearch: TAApplicationSearch = getRouteSearch();
  const applicationListHref = (() => {
    const params = new URLSearchParams();
    Object.entries(listSearch).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    });
    const query = params.toString();
    return query ? `/ta/applications?${query}` : "/ta/applications";
  })();

  // The tab from ?tab= wins; otherwise the stage and open interviews pick it (see defaultApplicationTab).
  const [tabOverride, setTabOverride] = useState<ApplicationTab | null>(() =>
    typeof window === "undefined" ? null : normalizeApplicationTab(new URLSearchParams(window.location.search).get("tab"))
  );

  const handleTabChange = (tab: ApplicationTab) => {
    setTabOverride(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const [dialog, setDialog] = useState<DialogState>(null);
  const [reissueOpen, setReissueOpen] = useState(false);
  const [reissuedSlip, setReissuedSlip] = useState<WalkInSlip | null>(null);
  const reissueMutation = useMutation({
    mutationFn: () => taApi.reissueWalkInSlip(applicationId),
    onSuccess: (slip) => {
      setReissueOpen(false);
      setReissuedSlip(slip);
      queryClient.invalidateQueries({ queryKey: ["ta", "application", String(applicationId)] });
    },
    onError: (error) => notify.error("Could not make a new slip", error),
  });
  const closeDialog = useCallback(() => setDialog(null), []);

  const [previewDocState, setPreviewDocState] = useState<{
    open: boolean;
    documentId?: number | null;
    fileUrl?: string | null;
    title?: string;
    requirementId?: number | null;
    requirementStatus?: string;
  } | null>(null);

  const isDesktop = useIsDesktop();
  const [isResumeOpen, setIsResumeOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(`megs_ta_resume_open_${applicationId}`);
      if (stored !== null) return stored === "true";
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [resumeDrawerOpen, setResumeDrawerOpen] = useState(false);
  const [stageBarHeight, setStageBarHeight] = useState(140);
  const [isVerifying, setIsVerifying] = useState(false);

  const toggleResume = (open: boolean) => {
    setIsResumeOpen(open);
    if (typeof window !== "undefined" && applicationId) {
      sessionStorage.setItem(`megs_ta_resume_open_${applicationId}`, String(open));
    }
  };

  // Queries
  const connected = useLiveStreamConnected();
  const applicationQuery = useQuery(taApplicationDetailQuery(applicationId, connected));
  const decisionsQuery = useQuery(taApplicationDecisionsQuery(applicationId));
  const parseProfileId = applicationQuery.data?.user?.applicantProfile?.id;
  const hasUploadedResume = Boolean((applicationQuery.data?.user?.applicantProfile?.resumeUrl || applicationQuery.data?.resumeUrl)?.trim());
  const parseState = useResumeParseState(parseProfileId, hasUploadedResume ? applicationQuery.data?.createdAt : null);
  const reparseMutation = useMutation({
    mutationFn: () => taProfileReviewApi.reparseResume(parseProfileId as number),
    onSuccess: (state) => {
      queryClient.setQueryData(resumeProposalKey(parseProfileId as number), state);
    },
    onError: (err: unknown) => notify.error("Could not read the resume", err),
  });
  const clientsQuery = useQuery(taClientsQuery());

  const appData = applicationQuery.data;
  const parsedAiAssessment = useMemo(() => parseCandidateAssessment(appData?.aiSummary), [appData?.aiSummary]);
  const profileForName = appData?.user?.applicantProfile;
  const candidateName = profileForName
    ? `${profileForName.firstName} ${profileForName.lastName}`
    : displayEmail(appData?.user?.email) || "Candidate";

  const m = useApplicationMutations({ applicationId, status: appData?.status });

  const backToList = (
    <Button asChild variant="outline" size="sm">
      <Link to="/ta/applications" search={listSearch}>
        Back to applications
      </Link>
    </Button>
  );
  const stateBreadcrumbs = [
    { label: TA_COPY.navigation.overview, href: "/ta" },
    { label: TA_COPY.navigation.applications, href: applicationListHref },
    { label: `Application #${applicationId}` },
  ];

  if (applicationQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Application #${applicationId}`} description="Loading candidate information..." breadcrumbs={stateBreadcrumbs} />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (applicationQuery.isError || !applicationQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Application #${applicationId}`} breadcrumbs={stateBreadcrumbs} actions={backToList} />
        <ErrorState error={applicationQuery.error} subject={`application #${applicationId}`} onRetry={() => applicationQuery.refetch()} />
      </div>
    );
  }

  const app = applicationQuery.data;
  const profile = app.user?.applicantProfile;
  // Placeholder addresses for phone sign-ups and walk-ins are never shown.
  const shownEmail = displayEmail(app.user?.email) ?? undefined;
  const candidateInitials = [profile?.firstName?.[0], profile?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "ID";
  const flags = deriveApplicationFlags(app);
  const decisions = Array.isArray(decisionsQuery.data) ? decisionsQuery.data : [];
  const clients = Array.isArray(clientsQuery.data) ? clientsQuery.data : [];

  const scores = app.candidateScores?.[0];
  const fitScore = scores?.finalFitScore ?? app.candidateFitScore ?? app.aiScore;
  const scoreExplanation = (() => {
    if (!scores?.explanation) return null;
    try {
      const parsed = typeof scores.explanation === "string" ? JSON.parse(scores.explanation) : scores.explanation;
      if (parsed && typeof parsed === "object") return parsed as any;
    } catch {
      // JSON parse fallback
    }
    return null;
  })();

  const latestEndorsement = flags.latestEndorsement;
  const linkedClient = app.jobPosting?.mrf?.client || latestEndorsement?.client;
  const linkedClientId = linkedClient?.id || app.jobPosting?.mrf?.clientId || latestEndorsement?.clientId || 0;
  const linkedClientName = linkedClient?.name || clients.find((c) => c.id === linkedClientId)?.name || "";
  const mrfLocation = (app.jobPosting?.mrf as any)?.location as string | undefined;
  const defaultSite = app.jobPosting?.location || mrfLocation || (linkedClient as any)?.address || "";
  const isFinalInterviewStage = app.status === ApplicationStatus.FINAL_INTERVIEW;

  const activeTab: ApplicationTab = tabOverride ?? defaultApplicationTab(app.status, Boolean(flags.pendingScreeningInterview || flags.pendingFinalInterview));
  const now = Date.now();

  const requirements = (app.complianceRequirements || []) as RequirementRowData[];
  const requirementCounts = {
    total: flags.totalCompReqs,
    approved: flags.approvedCompReqs,
    toFollow: flags.toFollowCompReqs,
    submitted: flags.submittedCompReqs,
    missing: flags.missingCompReqs,
  };

  // ---- stage bar -------------------------------------------------------------------------------
  const { primary, secondary, overflow } = pickStageBarActions(app, flags);
  const next = getNextStep(app, flags);
  const skippedStages = ((decisionsQuery.data as any[]) || [])
    .filter((d) => d.transitionType === "SKIP" && Array.isArray(d.skippedStages))
    .flatMap((d) =>
      (d.skippedStages as string[]).map((stage) => ({ stage, reason: d.reason, actorEmail: d.actor?.email, at: d.createdAt }))
    );
  const barActionIds: string[] = [primary?.id, secondary?.id, ...overflow.map((a) => a.id)].filter(Boolean) as string[];

  const openSchedule = (type: InterviewType, existing?: Interview | null) =>
    setDialog({
      kind: "schedule",
      type,
      isReschedule: Boolean(existing),
      initialDate: existing ? manilaIsoToDateTimeLocal(existing.scheduledAt) : "",
      currentDate: existing ? manilaIsoToDateTimeLocal(existing.scheduledAt) : undefined,
      initialLocation: existing?.location || "",
    });
  const openContractSigningSchedule = () =>
    setDialog({
      kind: "schedule",
      type: "CONTRACT_SIGNING",
      isReschedule: Boolean(app.contractSigningAt),
      initialDate: manilaIsoToDateTimeLocal(app.contractSigningAt),
      currentDate: manilaIsoToDateTimeLocal(app.contractSigningAt),
      initialLocation: app.contractSigningLocation || "",
    });
  const pendingReschedules = (app.rescheduleRequests || []).filter((r) => r.status === "PENDING");
  const rescheduleCurrentTime = (request: RescheduleRequest) =>
    request.activity === "CONTRACT_SIGNING"
      ? app.contractSigningAt
      : (app.interviews || []).find((i) => i.id === request.interviewId)?.scheduledAt;
  // The recruiter picks a new time, so the date starts empty; the place carries over.
  const openRescheduleAnswer = (request: RescheduleRequest) =>
    setDialog({
      kind: "schedule",
      type: request.activity,
      isReschedule: true,
      initialDate: "",
      currentDate: manilaIsoToDateTimeLocal(rescheduleCurrentTime(request)),
      initialLocation:
        (request.activity === "CONTRACT_SIGNING"
          ? app.contractSigningLocation
          : (app.interviews || []).find((i) => i.id === request.interviewId)?.location) || "",
      requestId: request.id,
    });
  const openOutcome = (interview: Interview | null, type: InterviewType) => setDialog({ kind: "outcome", interview, type });
  const openClientDecision = (end: NonNullable<typeof latestEndorsement>, fresh: boolean) =>
    setDialog({
      kind: "clientDecision",
      endorsementId: end.id,
      clientName: end.client?.name || linkedClientName || "Client",
      // A decision that is still open starts empty; an existing decision opens with its values.
      initialOutcome: fresh ? "" : end.outcome === "ENDORSED" ? "APPROVED" : (end.outcome as "PENDING" | "APPROVED" | "DECLINED"),
      // The decision note is separate from the note sent with the candidate, which only appears as context.
      initialNotes: fresh ? "" : end.decisionNotes || "",
      priorNote: end.notes ? { notes: end.notes, date: end.createdAt ? formatDate(end.createdAt) : "" } : null,
    });

  const runStageAction = (id: StageActionId) => {
    switch (id) {
      case "schedule-initial":
        return openSchedule(InterviewType.INITIAL_SCREENING);
      case "record-initial-outcome":
        return openOutcome(flags.pendingScreeningInterview || null, InterviewType.INITIAL_SCREENING);
      case "reschedule-initial":
        return openSchedule(InterviewType.INITIAL_SCREENING, flags.pendingScreeningInterview);
      case "send-to-client":
        return setDialog({ kind: "sendToClient", mode: "send" });
      case "skip-to-final":
        return setDialog({ kind: "skip" });
      case "move-to-final":
        return m.updateStatus.mutate({ status: ApplicationStatus.FINAL_INTERVIEW });
      case "fast-track":
        return setDialog({ kind: "fastTrack" });
      case "record-client-decision":
        return latestEndorsement && openClientDecision(latestEndorsement, true);
      case "update-client-decision":
        return latestEndorsement && openClientDecision(latestEndorsement, false);
      case "schedule-final":
        return openSchedule(InterviewType.FINAL_INTERVIEW);
      case "record-final-outcome":
        return openOutcome(flags.pendingFinalInterview || null, InterviewType.FINAL_INTERVIEW);
      case "reschedule-final":
        return openSchedule(InterviewType.FINAL_INTERVIEW, flags.pendingFinalInterview);
      case "move-to-requirements":
        return m.updateStatus.mutate({ status: ApplicationStatus.COMPLIANCE, reason: "Client accepted candidate for employment" });
      case "move-to-contract-signing":
        return m.updateStatus.mutate({ status: ApplicationStatus.CONTRACT_SIGNING, reason: "All mandatory clearances verified and approved." });
      case "confirm-contract-signed":
        return setDialog({ kind: "confirmSigned" });
      case "contract-not-signed":
        // The applicant did not sign: the TA rejects the application.
        return setDialog({ kind: "close", outcome: "REJECTED", contractNotSigned: true });
      case "deploy-applicant":
        return setDialog({ kind: "contract" });
      case "schedule-contract-signing":
      case "reschedule-contract-signing":
        return openContractSigningSchedule();
      case "activate-deployment":
        return setDialog({ kind: "deploy" });
      case "manage-contract-signing":
        return handleTabChange("requirements");
      default:
        return undefined;
    }
  };

  const pendingActionId = m.updateStatus.isPending
    ? primary?.id === "move-to-requirements" || primary?.id === "move-to-contract-signing"
      ? primary.id
      : null
    : null;

  // ---- header menu -----------------------------------------------------------------------------
  const menuItems: ActionMenuItem[] = [
    { label: "Refresh assessment", onSelect: () => m.analyze.mutate(), disabled: m.analyze.isPending },
    ...overflow.map((a) => ({ label: a.label, onSelect: () => runStageAction(a.id) })),
    ...(app.trackingCode || app.source === "WALK_IN" ? [{ label: app.trackingCode ? "Print new slip" : "Print slip", onSelect: () => setReissueOpen(true) }] : []),
    ...(flags.canReject ? [{ label: "Reject applicant", tone: "danger" as const, onSelect: () => setDialog({ kind: "close", outcome: "REJECTED" }) }] : []),
    ...(flags.canBackout ? [{ label: "Mark as backed out", tone: "danger" as const, onSelect: () => setDialog({ kind: "close", outcome: "BACKED_OUT" }) }] : []),
  ];

  // ---- tabs ------------------------------------------------------------------------------------
  const overdueInterviews = overdueInterviewCount(app.interviews || [], now);
  // One count: the items that wait for the recruiter's review.
  const requirementsBadge = !flags.canManageRequirements
    ? undefined
    : flags.canDeployCandidate
    ? "Ready to deploy"
    : flags.submittedCompReqs > 0
    ? `${flags.submittedCompReqs} to review`
    : undefined;

  const tabs: { id: ApplicationTab; label: string; badge?: { text: string; variant: "success" | "warning" | "info" } }[] = [
    { id: "profile", label: APPLICATION_TAB_LABELS.profile },
    {
      id: "interviews",
      label: APPLICATION_TAB_LABELS.interviews,
      badge: overdueInterviews > 0 ? { text: `${overdueInterviews} overdue`, variant: "warning" } : undefined,
    },
    {
      id: "requirements",
      label: APPLICATION_TAB_LABELS.requirements,
      badge: requirementsBadge ? { text: requirementsBadge, variant: flags.canDeployCandidate ? "success" : "info" } : undefined,
    },
    { id: "activity", label: APPLICATION_TAB_LABELS.activity },
  ];

  // ---- resume ----------------------------------------------------------------------------------
  const resumeUrl = profile?.resumeUrl || app.resumeUrl;
  const openResumeFullscreen = () => {
    setResumeDrawerOpen(false);
    setPreviewDocState({ open: true, documentId: extractDocumentId(resumeUrl), fileUrl: resumeUrl, title: "Application Resume (CV)" });
  };
  // The resume sits beside Profile, Interviews and Requirements. Activity has nothing to compare it with.
  // It is the uploaded file, the MEGS resume built from the profile, or both.
  const megsResume = profile ? { profile, email: shownEmail, reference: app.trackingCode, requirements } : undefined;
  const hasResume = Boolean(resumeUrl?.trim());
  const resumeTabActive = activeTab !== "activity" && (hasResume || Boolean(profile));
  const showResumeRail = isDesktop && isResumeOpen && resumeTabActive;
  const showResumeDock = isDesktop && !isResumeOpen && resumeTabActive;
  const railTop = 56 + stageBarHeight + 8;

  const personalDetails = (
    <PersonalDetails
      profile={profile}
      candidateName={candidateName}
      candidateInitials={candidateInitials}
      email={shownEmail}
      onVerify={profile ? () => setIsVerifying(true) : undefined}
      readState={resumeReadState(parseState.data, hasResume ? app.createdAt : null, Date.now(), countActionable(parseState.data?.pending?.proposal) > 0)}
      onRetryRead={resumeUrl?.trim() ? () => reparseMutation.mutate() : undefined}
      isRetrying={reparseMutation.isPending}
      onOpenPhoto={() =>
        setPreviewDocState({
          open: true,
          documentId: extractDocumentId(profile?.photoUrl),
          fileUrl: profile?.photoUrl,
          title: "Identification Photo",
        })
      }
    />
  );

  const requirementsResult =
    [ApplicationStatus.COMPLIANCE, ApplicationStatus.CONTRACT_SIGNING, ApplicationStatus.ONBOARDING, ApplicationStatus.DEPLOYED, ApplicationStatus.HIRED].includes(
      app.status as any
    ) && flags.totalCompReqs > 0
      ? { approved: flags.approvedCompReqs, total: flags.totalCompReqs }
      : null;

  const scheduleOfferType = flags.nextSchedulableInterview;
  const scheduleOfferId = scheduleOfferType === "FINAL_INTERVIEW" ? "schedule-final" : "schedule-initial";
  const scheduleOffer =
    scheduleOfferType && !barActionIds.includes(scheduleOfferId)
      ? {
          type: scheduleOfferType,
          label: scheduleOfferType === "FINAL_INTERVIEW" ? "Schedule final interview" : "Schedule interview",
        }
      : null;

  // ---- dialogs ---------------------------------------------------------------------------------
  const dlg = dialog;
  const outcomeDialog = dlg?.kind === "outcome" ? dlg : null;
  const reviewRequirement = dlg?.kind === "review" ? requirements.find((r) => r.id === dlg.requirementId) : undefined;
  // The review dialog lists every document that still needs action, like the requirements queue does,
  // so one pass covers them all. The document that was opened stays in the list even if it is already approved.
  const reviewList = (app.complianceRequirements || []).filter(
    (r) => r.reviewStatus !== "APPROVED" || (dlg?.kind === "review" && r.id === dlg.requirementId)
  );
  const deadlineRequirement = dlg?.kind === "editDeadline" ? app.complianceRequirements?.find((r) => r.id === dlg.requirementId) ?? null : null;
  const feedback = m.feedback;
  const jobTitle = app.jobPosting?.title;
  const closure = (app.closures ?? [])[0];
  const deployment = app.deployments?.[0];
  const showDeploymentLink = Boolean(deployment?.id) && (app.status === ApplicationStatus.DEPLOYED || flags.isContractSigned);
  const contractSignedOnly = app.status === ApplicationStatus.DEPLOYED && deployment?.status === "READY_FOR_DEPLOYMENT";

  const resumeDrawer = !isDesktop ? (
    <ResumeDrawerButton
      open={resumeDrawerOpen}
      onOpenChange={setResumeDrawerOpen}
      resumeUrl={resumeUrl}
      candidateName={candidateName}
      megs={megsResume}
      onFullscreen={openResumeFullscreen}
    />
  ) : null;

  return (
    <div className="space-y-3">
      <ApplicationSummary
        candidateName={candidateName}
        candidateInitials={candidateInitials}
        applicationId={app.id}
        jobId={app.jobPosting?.id}
        jobTitle={jobTitle}
        email={shownEmail}
        mobileNumber={profile?.mobileNumber}
        city={[profile?.city, profile?.province].filter(Boolean).join(", ")}
        submittedAt={app.createdAt}
        daysInStage={daysInStage(app, decisions, now)}
        interviewText={summarizeInterview(app.interviews || [], now)}
        score={fitScore}
        status={app.status}
        contractSignedOnly={contractSignedOnly}
        listHref={applicationListHref}
        menuItems={menuItems}
        sourceChip={<SourceChip source={app.source} />}
        resumeAction={resumeDrawer}
        stepper={
          <PipelineIndicator
            variant="compact"
            currentStatus={app.status}
            hideTerminalAlert
            currentLabel={formatTaStatus(app.status)}
            skippedStages={skippedStages}
            skipClientReview={!flags.requiresClientReview}
          />
        }
      />

      {closure && (
        <div role="status" className="space-y-0.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-semibold">
            {CLOSURE_OUTCOME_LABELS[closure.outcome]} · {closureReasonLabel(closure.reasonCode)}
            {closure.disposition ? ` · ${CLOSURE_DISPOSITION_LABELS[closure.disposition]}` : ""}
          </p>
          <p>
            At {formatTaStatus(closure.stage)} on {formatDate(closure.occurredAt)}
            {closure.notes ? ` — ${closure.notes}` : ""}
          </p>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
            feedback.type === "success" ? "border-navy-line bg-navy-soft text-navy" : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => m.setFeedback(null)}
            aria-label="Dismiss message"
            className="focus-ring ml-4 inline-flex min-h-11 min-w-11 items-center justify-center text-lg font-bold text-slate-600 hover:text-slate-900 md:min-h-8 md:min-w-8"
          >
            ×
          </button>
        </div>
      )}

      {pendingReschedules.map((request) => (
        <RescheduleRequestNotice
          key={request.id}
          candidateName={candidateName}
          request={request}
          currentScheduledAt={rescheduleCurrentTime(request)}
          onPickTime={openRescheduleAnswer}
          onDecline={(r) => setDialog({ kind: "declineReschedule", request: r })}
        />
      ))}

      <StageBar
        status={app.status}
        stageLabel={contractSignedOnly ? "Contract signed" : undefined}
        next={next}
        primary={primary}
        secondary={secondary}
        pendingActionId={pendingActionId}
        onAction={(action) => runStageAction(action.id)}
        deploymentId={showDeploymentLink ? deployment?.id : null}
        extraAction={
          flags.isClientDeclined && flags.canReject
            ? { label: "Reject applicant", onClick: () => setDialog({ kind: "close", outcome: "REJECTED" }) }
            : null
        }
        onHeightChange={setStageBarHeight}
      />

      <Tabs
        value={activeTab}
        onChange={(tab) => handleTabChange(tab as ApplicationTab)}
        ariaLabel="Candidate record sections"
        className="rounded-md border border-slate-300"
        items={tabs.map((tab) => ({ ...tab, panelId: `application-tabpanel-${tab.id}`, tabId: `application-tab-${tab.id}` }))}
      />

      <DetailLayout
        className="[&>aside]:self-stretch"
        railLabel="Resume"
        resizable
        storageKey="megs_ta_resume_rail"
        rail={
          showResumeRail ? (
            <ResumeRail
              resumeUrl={resumeUrl}
              candidateName={candidateName}
              megs={megsResume}
              onFullscreen={openResumeFullscreen}
              onHide={() => toggleResume(false)}
              topOffset={railTop}
            />
          ) : undefined
        }
        main={
          <div
            id={`application-tabpanel-${activeTab}`}
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`application-tab-${activeTab}`}
            className="focus-ring-inset rounded-md border border-slate-300 bg-white p-4 sm:p-6"
          >
            {activeTab === "profile" && (
              <ProfileTab
                personal={personalDetails}
                match={{
                  scores,
                  explanation: scoreExplanation,
                  requirementsResult,
                }}
                assessment={parsedAiAssessment}
                background={{ profile, jobPosting: app.jobPosting }}
              />
            )}

            {activeTab === "interviews" && (
              <InterviewsTab
                interviews={app.interviews || []}
                now={now}
                scheduleOffer={scheduleOffer}
                onSchedule={(type) => openSchedule(type === "FINAL_INTERVIEW" ? InterviewType.FINAL_INTERVIEW : InterviewType.INITIAL_SCREENING)}
                onRecordOutcome={(interview) => openOutcome(interview, interview.type)}
                onReschedule={(interview) => openSchedule(interview.type, interview)}
                heroActionsInBar={barActionIds.includes("record-initial-outcome") || barActionIds.includes("record-final-outcome")}
              />
            )}

            {activeTab === "requirements" && (
              <RequirementsTab
                clientReview={{
                  endorsements: (app.clientEndorsements || []) as any,
                  fallbackClientName: linkedClientName,
                  notRequired: !flags.requiresClientReview,
                  isPastClientReview: flags.isPastClientReview,
                  canRecordDecision: flags.canRecordClientReview,
                  stageBarOwnsDecision: flags.isClientEndorsementStage && flags.isPendingClientReview,
                  onRecordDecision: (end) => {
                    const real = (app.clientEndorsements || []).find((e) => e.id === end.id);
                    if (real) openClientDecision(real, real.outcome === "PENDING");
                  },
                  onRecordMissing: () => setDialog({ kind: "sendToClient", mode: "record" }),
                }}
                applicationId={applicationId}
                applicantHasPortalAccess={app.hasPortalAccess !== false}
                isDeployed={app.status === ApplicationStatus.DEPLOYED}
                requirements={requirements}
                counts={requirementCounts}
                showReadiness={flags.isComplianceStage || flags.isContractSigningStage || (flags.isTerminal && requirements.length > 0) || app.status === ApplicationStatus.DEPLOYED}
                isAllApproved={flags.isAllClearancesApproved}
                canManage={flags.canManageRequirements}
                canRemove={!["CONTRACT_SIGNING", "DEPLOYED"].includes(String(app.status))}
                onAdd={() => setDialog({ kind: "addRequirement" })}
                onView={(req) =>
                  setPreviewDocState({
                    open: true,
                    documentId: req.documentId,
                    title: req.documentLabel,
                    requirementId: req.id,
                    requirementStatus: req.reviewStatus,
                  })
                }
                onReview={(req) => setDialog({ kind: "review", requirementId: req.id })}
                onRequestCopy={(req) => setDialog({ kind: "updateCopy", target: { id: req.id, label: req.documentLabel } })}
                onEditDeadline={(req) =>
                  setDialog({
                    kind: "editDeadline",
                    requirementId: req.id,
                    initialDate: req.deadline ? new Date(req.deadline).toISOString().split("T")[0] : new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
                  })
                }
                onRemove={(req) => setDialog({ kind: "removeRequirement", target: { id: req.id, label: req.documentLabel } })}
                readiness={
                  <OnboardingDeploymentStepper
                    app={app}
                    totalCompReqs={flags.totalCompReqs}
                    approvedCompReqs={flags.approvedCompReqs}
                    submittedCompReqs={flags.submittedCompReqs}
                    missingCompReqs={flags.missingCompReqs}
                    hasUnapprovedMandatoryCompliance={flags.hasUnapprovedMandatoryCompliance}
                    isComplianceStage={flags.isComplianceStage}
                    canAdvanceToContractSigning={flags.canAdvanceToContractSigning}
                    isAdvancingToContractSigning={m.updateStatus.isPending}
                    isContractSigningStage={flags.isContractSigningStage}
                    isContractSigned={flags.isContractSigned}
                    isReadyForDeployment={flags.isReadyForDeployment}
                    canDeployCandidate={flags.canDeployCandidate}
                    openDeployment={flags.openDeployment}
                    linkedClientName={linkedClientName}
                    onOpenComplianceTab={() => {
                      document.getElementById("compliance-checklist-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    onAdvanceToContractSigning={() => {
                      m.updateStatus.mutate({
                        status: ApplicationStatus.CONTRACT_SIGNING,
                        reason: "All mandatory clearances approved. Moving to contract signing.",
                      });
                    }}
                    onDeployCandidate={() => setDialog({ kind: app.status === ApplicationStatus.CONTRACT_SIGNING ? "contract" : "deploy" })}
                  />
                }
              />
            )}

            {activeTab === "activity" && <ActivityTab events={buildActivity(app, decisions)} isLoading={decisionsQuery.isLoading} />}
          </div>
        }
      />

      {showResumeDock && <ResumeDockTab onShow={() => toggleResume(true)} />}

      {isVerifying && profile && (
        <BioDataReviewPanel
          applicationId={applicationId}
          profile={profile}
          candidateName={candidateName}
          resumeUrl={resumeUrl}
          email={shownEmail}
          reference={app.trackingCode}
          requirements={requirements}
          onClose={() => setIsVerifying(false)}
        />
      )}

      {/* Dialogs */}
      <InterviewOutcomeDialog
        open={Boolean(outcomeDialog)}
        onClose={closeDialog}
        candidateName={candidateName}
        jobTitle={jobTitle}
        isFinalInterview={(outcomeDialog?.interview?.type ?? outcomeDialog?.type) === InterviewType.FINAL_INTERVIEW}
        scheduledAt={outcomeDialog?.interview?.scheduledAt}
        isSubmitting={m.updateInterviewStatus.isPending}
        onSubmit={({ result, notes }) => {
          if (!outcomeDialog) return;
          const targetType =
            outcomeDialog.interview?.type || (isFinalInterviewStage ? InterviewType.FINAL_INTERVIEW : InterviewType.INITIAL_SCREENING);
          m.updateInterviewStatus.mutate({ interviewId: outcomeDialog.interview?.id, type: targetType, result, notes }, { onSuccess: closeDialog });
        }}
      />

      <ScheduleInterviewDialog
        open={dlg?.kind === "schedule"}
        onClose={closeDialog}
        candidateName={candidateName}
        candidateEmail={shownEmail}
        candidateMobile={profile?.mobileNumber}
        type={dlg?.kind === "schedule" ? dlg.type : InterviewType.INITIAL_SCREENING}
        isReschedule={dlg?.kind === "schedule" ? dlg.isReschedule : false}
        initialDate={dlg?.kind === "schedule" ? dlg.initialDate : ""}
        currentDate={dlg?.kind === "schedule" ? dlg.currentDate : undefined}
        initialLocation={dlg?.kind === "schedule" ? dlg.initialLocation : ""}
        isSubmitting={m.scheduleInterview.isPending || m.scheduleContractSigning.isPending || m.approveReschedule.isPending}
        onSubmit={(values) => {
          if (dlg?.kind !== "schedule") return;
          if (dlg.requestId) {
            m.approveReschedule.mutate(
              { requestId: dlg.requestId, scheduledAt: values.scheduledAt, location: values.location },
              { onSuccess: closeDialog }
            );
          } else if (values.type === "CONTRACT_SIGNING") {
            m.scheduleContractSigning.mutate(
              { scheduledAt: values.scheduledAt, location: values.location ?? "" },
              { onSuccess: closeDialog }
            );
          } else {
            m.scheduleInterview.mutate({ ...values, type: values.type }, { onSuccess: closeDialog });
          }
        }}
      />

      <DeclineRescheduleDialog
        open={dlg?.kind === "declineReschedule"}
        onClose={closeDialog}
        candidateName={candidateName}
        activity={dlg?.kind === "declineReschedule" ? dlg.request.activity : null}
        isSubmitting={m.rejectReschedule.isPending}
        onSubmit={(decisionNote) => {
          if (dlg?.kind !== "declineReschedule") return;
          m.rejectReschedule.mutate({ requestId: dlg.request.id, decisionNote }, { onSuccess: closeDialog });
        }}
      />

      <SendToClientDialog
        open={dlg?.kind === "sendToClient"}
        onClose={closeDialog}
        mode={dlg?.kind === "sendToClient" ? dlg.mode : "send"}
        candidateName={candidateName}
        linkedClientId={linkedClientId}
        linkedClientName={linkedClientName}
        jobTitle={jobTitle}
        requestTitle={app.jobPosting?.mrf?.title}
        clients={clients}
        initialClientId={linkedClientId || null}
        isSubmitting={m.endorse.isPending}
        onSubmit={(values) => m.endorse.mutate(values, { onSuccess: closeDialog })}
      />

      <ClientDecisionDialog
        open={dlg?.kind === "clientDecision"}
        onClose={closeDialog}
        clientName={dlg?.kind === "clientDecision" ? dlg.clientName : linkedClientName}
        jobTitle={jobTitle}
        requestTitle={app.jobPosting?.mrf?.title}
        priorNote={dlg?.kind === "clientDecision" ? dlg.priorNote : null}
        initialOutcome={dlg?.kind === "clientDecision" ? dlg.initialOutcome : ""}
        initialNotes={dlg?.kind === "clientDecision" ? dlg.initialNotes : ""}
        isSubmitting={m.updateEndorsement.isPending}
        onSubmit={(values) => {
          if (dlg?.kind !== "clientDecision") return;
          m.updateEndorsement.mutate({ endorsementId: dlg.endorsementId, ...values }, { onSuccess: closeDialog });
        }}
      />

      <AddRequirementDialog
        open={dlg?.kind === "addRequirement"}
        onClose={closeDialog}
        existingLabels={(app.complianceRequirements || []).map((r) => r.documentLabel)}
        isSubmitting={m.addRequirement.isPending}
        onSubmit={(values) => m.addRequirement.mutate(values, { onSuccess: closeDialog })}
      />

      <EditDeadlineDialog
        open={dlg?.kind === "editDeadline"}
        onClose={closeDialog}
        requirement={deadlineRequirement}
        initialDate={dlg?.kind === "editDeadline" ? dlg.initialDate : ""}
        isSubmitting={m.updateDeadline.isPending}
        onSubmit={(values) => m.updateDeadline.mutate(values, { onSuccess: closeDialog })}
      />

      <RequirementReviewDialog
        open={dlg?.kind === "review" && Boolean(reviewRequirement)}
        onClose={closeDialog}
        mode="pre"
        subtitle={[candidateName, jobTitle].filter(Boolean).join(" · ")}
        requirements={reviewList}
        initialRequirementId={dlg?.kind === "review" ? dlg.requirementId : null}
        renderDocumentPreview={(req) =>
          req.documentId ? (
            <RequirementDocumentPreview
              documentId={req.documentId}
              documentLabel={req.documentLabel}
              onExpand={() =>
                setPreviewDocState({
                  open: true,
                  documentId: req.documentId,
                  requirementId: req.id,
                  title: req.documentLabel,
                  requirementStatus: req.reviewStatus,
                })
              }
            />
          ) : null
        }
        isSubmitting={m.reviewRequirement.isPending}
        onOpenDocument={(req) =>
          setPreviewDocState({
            open: true,
            documentId: req.documentId,
            requirementId: req.id,
            title: req.documentLabel,
            requirementStatus: req.reviewStatus,
          })
        }
        onSubmit={(values, req) =>
          m.reviewRequirement.mutate({ id: req.id, data: values as ReviewComplianceDto }, { onSuccess: closeDialog })
        }
      />

      {dlg?.kind === "updateCopy" && <DocumentUpdateRequestDialog key={dlg.target.id} target={dlg.target} onClose={closeDialog} />}

      <DocumentPreviewModal
        open={Boolean(previewDocState?.open)}
        onClose={() => setPreviewDocState(null)}
        documentId={previewDocState?.documentId}
        fileUrl={previewDocState?.fileUrl}
        title={previewDocState?.title || "Compliance Document"}
        applicantName={candidateName}
        requirementStatus={previewDocState?.requirementStatus}
        // Approved documents use "Request updated copy" on the row instead of Reject.
        onReject={
          previewDocState?.requirementStatus === "APPROVED" || !flags.canManageRequirements
            ? undefined
            : (notes) => {
                if (!notes.trim()) {
                  notify.error("Rejection note required", "Please add a note explaining why this was rejected.");
                  return;
                }
                if (previewDocState?.requirementId) {
                  m.reviewRequirement.mutate({ id: previewDocState.requirementId, data: { reviewStatus: "REJECTED", reviewNotes: notes } });
                  setPreviewDocState(null);
                }
              }
        }
        isActionLoading={m.reviewRequirement.isPending}
      />

      <ActivateDeploymentDialog
        open={dlg?.kind === "deploy"}
        onClose={closeDialog}
        candidateName={candidateName}
        linkedClientId={linkedClientId}
        linkedClientName={linkedClientName}
        jobTitle={jobTitle}
        requestTitle={app.jobPosting?.mrf?.title}
        clients={clients}
        initialClientId={linkedClientId || latestEndorsement?.clientId || 0}
        initialSite={defaultSite}
        mrfLocation={mrfLocation}
        jobLocation={app.jobPosting?.location}
        linkedClientAddress={(linkedClient as any)?.address}
        isSubmitting={m.deploy.isPending}
        onSubmit={(values) => m.deploy.mutate(values, { onSuccess: closeDialog })}
      />

      <ConfirmDialog
        open={dlg?.kind === "confirmSigned"}
        onClose={closeDialog}
        onConfirm={() => m.confirmContractSigned.mutate(undefined, { onSuccess: closeDialog })}
        title="Confirm the contract was signed?"
        description={`Confirm that ${candidateName} signed the contract. This can't be undone. If they did not sign, choose Not signed to reject the application instead.`}
        confirmLabel="Yes, contract signed"
        cancelLabel="Cancel"
        variant="warning"
        loading={m.confirmContractSigned.isPending}
      />

      <ConfirmDialog
        open={reissueOpen}
        onClose={() => setReissueOpen(false)}
        onConfirm={() => reissueMutation.mutate()}
        title={app.trackingCode ? "Print a new slip?" : "Print a tracking slip for this applicant?"}
        description={app.trackingCode ? "The old slip will stop working." : "The applicant can scan it to see their progress."}
        confirmLabel={app.trackingCode ? "Print new slip" : "Print slip"}
        cancelLabel="Cancel"
        variant="warning"
        loading={reissueMutation.isPending}
      />
      {reissuedSlip && (
        <Suspense fallback={null}>
          <WalkInSlipDialog slip={reissuedSlip} onClose={() => setReissuedSlip(null)} />
        </Suspense>
      )}

      <ConfirmDialog
        open={dlg?.kind === "removeRequirement"}
        onClose={closeDialog}
        onConfirm={() => {
          if (dlg?.kind === "removeRequirement") m.deleteRequirement.mutate(dlg.target.id, { onSuccess: closeDialog });
        }}
        title="Remove requirement?"
        description={`Remove '${dlg?.kind === "removeRequirement" ? dlg.target.label : ""}' from this candidate's requirements checklist?`}
        confirmLabel="Remove requirement"
        cancelLabel="Cancel"
        variant="danger"
        loading={m.deleteRequirement.isPending}
      />

      <SkipToFinalDialog
        open={dlg?.kind === "skip"}
        onClose={closeDialog}
        candidateName={candidateName}
        isSubmitting={m.updateStatus.isPending}
        onSubmit={(reason) =>
          m.updateStatus.mutate({ status: ApplicationStatus.FINAL_INTERVIEW, reason }, { onSettled: closeDialog })
        }
      />

      <FastTrackDialog
        open={dlg?.kind === "fastTrack"}
        onClose={closeDialog}
        candidateName={candidateName}
        isSubmitting={m.fastTrack.isPending}
        onSubmit={(targetStage) => m.fastTrack.mutate({ targetStage }, { onSuccess: closeDialog })}
      />

      <ResumeAnalysisDialog
        open={m.analysis.open}
        onClose={() => m.analysis.setOpen(false)}
        applicationId={applicationId}
        candidateName={candidateName}
        runId={m.analysis.runId}
        onFinished={m.analysis.onFinished}
      />

      <CloseApplicationDialog
        open={dlg?.kind === "close"}
        onClose={closeDialog}
        onSubmit={(data) => m.close.mutate(data, { onSuccess: closeDialog })}
        loading={m.close.isPending}
        outcome={dlg?.kind === "close" ? dlg.outcome : "REJECTED"}
        stage={app.status}
        candidateName={candidateName}
        applicationCreatedOn={app.createdAt ? getManilaToday(new Date(app.createdAt)) : undefined}
        contractNotSigned={dlg?.kind === "close" && Boolean(dlg.contractNotSigned)}
      />

      <SignedContractDialog
        open={dlg?.kind === "contract"}
        onClose={closeDialog}
        candidateName={candidateName}
        linkedClientId={linkedClientId}
        linkedClientName={linkedClientName}
        site={defaultSite}
        initialStartDate={app.contractStartDate ? String(app.contractStartDate).slice(0, 10) : addManilaCalendarDays(getManilaToday(), 1)}
        isSubmitting={m.deployAfterContractSigning.isPending}
        onSubmit={(values) => m.deployAfterContractSigning.mutate(values, { onSuccess: closeDialog })}
      />
    </div>
  );
};
