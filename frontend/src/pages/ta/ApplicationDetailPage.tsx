import React, { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { PageHeader, LoadingState, ErrorState, DocumentPreviewModal, Tabs, ConfirmDialog } from "../../components/common";
import type { ActionMenuItem } from "../../components/common";
import { Button, manilaIsoToDateTimeLocal } from "../../components/ui";
import { OnboardingDeploymentStepper } from "../../components/ta/OnboardingDeploymentStepper";
import { ResumeAnalysisDialog } from "../../components/ta/ResumeAnalysisDialog";
import { parseCandidateAssessment } from "../../components/ta/CandidateAssessmentPanel";
import { CloseApplicationDialog } from "../../components/ta/CloseApplicationDialog";
import { InterviewOutcomeDialog } from "../../components/ta/InterviewOutcomeDialog";
import { RequirementReviewDialog } from "../../components/ta/RequirementReviewDialog";
import { DocumentUpdateRequestDialog } from "../../components/ta/DocumentUpdateRequestDialog";
import { CaseHeader } from "../../components/ta/application/CaseHeader";
import { StageBar } from "../../components/ta/application/StageBar";
import { ProfileTab } from "../../components/ta/application/ProfileTab";
import { RequirementsTab } from "../../components/ta/application/RequirementsTab";
import { ActivityTab } from "../../components/ta/application/ActivityTab";
import { PersonalDetails } from "../../components/ta/application/PersonalDetails";
import { ProfileEditForm } from "../../components/ta/application/ProfileEditForm";
import { ResumeColumn, ResumeDrawerButton } from "../../components/ta/application/ResumePanel";
import { useIsDesktop } from "../../components/ta/application/useIsDesktop";
import { ScheduleInterviewDialog } from "../../components/ta/application/ScheduleInterviewDialog";
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
import { formatDate, extractDocumentId } from "../../lib/utils";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../lib/query-policies";
import { ApplicationStatus, InterviewType } from "../../lib/types/enums";
import type { Interview } from "../../lib/types/application.types";
import type { UpdateCandidateProfileDto, ReviewComplianceDto } from "../../lib/types/ta.types";
import { notify } from "../../lib/feedback";
import type { TAApplicationSearch } from "../../routes";
import { TA_COPY, formatTaStatus } from "../../lib/ta-copy";
import { addManilaCalendarDays, getManilaToday } from "../../lib/field-limits";

type TabKey = "evaluation" | "compliance" | "history";

/** Old links and notifications use several names for the same three tabs. */
const normalizeTab = (tab: string | null): TabKey | null => {
  if (!tab) return null;
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

/** From requirements onward the useful content is on the requirements tab. */
const defaultTabForStatus = (status?: string): TabKey =>
  status === ApplicationStatus.COMPLIANCE ||
  status === ApplicationStatus.CONTRACT_SIGNING ||
  status === ApplicationStatus.ONBOARDING ||
  status === ApplicationStatus.HIRED ||
  status === ApplicationStatus.DEPLOYED
    ? "compliance"
    : "evaluation";

type DialogState =
  | null
  | { kind: "schedule"; type: InterviewType; isReschedule: boolean; initialDate: string; initialNotes: string }
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
  | { kind: "close"; outcome: ClosureOutcome };

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

  // The tab from ?tab= wins; otherwise the stage picks it (see defaultTabForStatus).
  const [tabOverride, setTabOverride] = useState<TabKey | null>(() =>
    typeof window === "undefined" ? null : normalizeTab(new URLSearchParams(window.location.search).get("tab"))
  );

  const handleTabChange = (tab: TabKey) => {
    setTabOverride(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const [dialog, setDialog] = useState<DialogState>(null);
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
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const toggleResume = (open: boolean) => {
    setIsResumeOpen(open);
    if (typeof window !== "undefined" && applicationId) {
      sessionStorage.setItem(`megs_ta_resume_open_${applicationId}`, String(open));
    }
  };

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
    queryFn: ({ signal }) => taApi.listClients({ signal }),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const appData = applicationQuery.data;
  const parsedAiAssessment = useMemo(() => parseCandidateAssessment(appData?.aiSummary), [appData?.aiSummary]);
  const profileForName = appData?.user?.applicantProfile;
  const candidateName = profileForName
    ? `${profileForName.firstName} ${profileForName.lastName}`
    : appData?.user?.email || "Candidate";

  const m = useApplicationMutations({ applicationId, status: appData?.status, candidateName });

  const updateCandidateMutation = useMutation({
    mutationFn: (data: UpdateCandidateProfileDto) => {
      const profileId = applicationQuery.data?.user?.applicantProfile?.id;
      if (!profileId) throw new Error("No applicant profile to update");
      return taApi.updateCandidateProfile(profileId, data);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });
      notify.success("Profile Verified", "Candidate details updated successfully.");
      (updated?.warnings ?? []).forEach((warning) => notify.warning("Possible duplicate", warning));
      setIsEditingProfile(false);
    },
    onError: (err: any) => {
      notify.error("Update Failed", err);
    },
  });

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

  const activeTab: TabKey = tabOverride ?? defaultTabForStatus(app.status);

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
      initialNotes: existing?.notes || "",
    });
  const openOutcome = (interview: Interview | null, type: InterviewType) => setDialog({ kind: "outcome", interview, type });
  const openClientDecision = (end: NonNullable<typeof latestEndorsement>, fresh: boolean) =>
    setDialog({
      kind: "clientDecision",
      endorsementId: end.id,
      clientName: end.client?.name || linkedClientName || "Client",
      // A decision that is still open starts empty; an existing decision opens with its values.
      initialOutcome: fresh ? "" : end.outcome === "ENDORSED" ? "APPROVED" : (end.outcome as "PENDING" | "APPROVED" | "DECLINED"),
      initialNotes: fresh ? "" : end.notes || "",
      priorNote: fresh && end.notes ? { notes: end.notes, date: end.createdAt ? formatDate(end.createdAt) : "" } : null,
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
      case "upload-contract":
        return setDialog({ kind: "contract" });
      case "activate-deployment":
        return setDialog({ kind: "deploy" });
      case "manage-contract-signing":
        return handleTabChange("compliance");
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
    ...(flags.canReject ? [{ label: "Reject applicant", tone: "danger" as const, onSelect: () => setDialog({ kind: "close", outcome: "REJECTED" }) }] : []),
    ...(flags.canBackout ? [{ label: "Mark as backed out", tone: "danger" as const, onSelect: () => setDialog({ kind: "close", outcome: "BACKED_OUT" }) }] : []),
  ];

  // ---- tabs ------------------------------------------------------------------------------------
  const profileBadge =
    flags.pendingScreeningInterview || flags.pendingFinalInterview
      ? "1 interview"
      : flags.isPreScreeningOrScreening && !flags.hasPassedScreening
      ? "Decide next step"
      : undefined;
  // One count: the items that wait for the recruiter's review.
  const requirementsBadge = flags.canDeployCandidate
    ? "Ready to deploy"
    : flags.submittedCompReqs > 0
    ? `${flags.submittedCompReqs} to review`
    : undefined;

  const tabs = [
    {
      id: "evaluation" as TabKey,
      label: TA_COPY.applicationDetail.tabs.profile,
      badge: profileBadge ? { text: profileBadge, variant: (profileBadge === "1 interview" ? "info" : "warning") as "info" | "warning" } : undefined,
    },
    {
      id: "compliance" as TabKey,
      label: TA_COPY.applicationDetail.tabs.requirements,
      badge: requirementsBadge ? { text: requirementsBadge, variant: (flags.canDeployCandidate ? "success" : "info") as "success" | "info" } : undefined,
    },
    { id: "history" as TabKey, label: TA_COPY.applicationDetail.tabs.activity },
  ];

  // ---- profile tab -----------------------------------------------------------------------------
  const startEditingProfile = () => {
    if (!profile) return;
    if (!isResumeOpen) toggleResume(true);
    setIsEditingProfile(true);
  };
  const resumeUrl = profile?.resumeUrl || app.resumeUrl;
  const openResumeFullscreen = () =>
    setPreviewDocState({ open: true, documentId: extractDocumentId(resumeUrl), fileUrl: resumeUrl, title: "Application Resume (CV)" });

  const resumeBesideContent = isDesktop && isResumeOpen && activeTab === "evaluation";
  const personalDetails = (
    <PersonalDetails
      profile={profile}
      candidateName={candidateName}
      candidateInitials={candidateInitials}
      onVerify={startEditingProfile}
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

  const resumeAction = !resumeBesideContent ? (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
      <span className="text-sm font-semibold text-slate-700">Candidate profile</span>
      {isDesktop ? (
        <Button variant="outline" size="sm" onClick={() => toggleResume(true)} aria-label="View Resume" title="Show resume panel side-by-side">
          View resume
        </Button>
      ) : (
        <ResumeDrawerButton
          open={resumeDrawerOpen}
          onOpenChange={setResumeDrawerOpen}
          resumeUrl={resumeUrl}
          candidateName={candidateName}
          candidateInitials={candidateInitials}
          onFullscreen={openResumeFullscreen}
        />
      )}
    </div>
  ) : null;

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
  const deadlineRequirement = dlg?.kind === "editDeadline" ? app.complianceRequirements?.find((r) => r.id === dlg.requirementId) ?? null : null;
  const reviewable = reviewRequirement as any;
  const feedback = m.feedback;
  const jobTitle = app.jobPosting?.title;

  return (
    <div className="space-y-4">
      <CaseHeader
        candidateName={candidateName}
        applicationId={app.id}
        jobTitle={jobTitle}
        email={app.user?.email}
        mobileNumber={profile?.mobileNumber}
        submittedAt={app.createdAt}
        score={fitScore}
        listHref={applicationListHref}
        menuItems={menuItems}
      />

      {(app.closures ?? [])[0] && (
        <div role="status" className="space-y-0.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-semibold">
            {CLOSURE_OUTCOME_LABELS[(app.closures ?? [])[0].outcome]} · {closureReasonLabel((app.closures ?? [])[0].reasonCode)}
            {(app.closures ?? [])[0].disposition ? ` · ${CLOSURE_DISPOSITION_LABELS[(app.closures ?? [])[0].disposition!]}` : ""}
          </p>
          <p>
            At {formatTaStatus((app.closures ?? [])[0].stage)} on {formatDate((app.closures ?? [])[0].occurredAt)}
            {(app.closures ?? [])[0].notes ? ` — ${(app.closures ?? [])[0].notes}` : ""}
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

      <StageBar
        status={app.status}
        next={next}
        primary={primary}
        secondary={secondary}
        pendingActionId={pendingActionId}
        onAction={(action) => runStageAction(action.id)}
        skippedStages={skippedStages}
        onHeightChange={setStageBarHeight}
      />

      <div className={resumeBesideContent ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)]" : ""}>
        <div className="min-w-0 border border-slate-300 bg-white">
          <Tabs
            value={activeTab}
            onChange={(tab) => handleTabChange(tab as TabKey)}
            ariaLabel="Candidate record sections"
            items={tabs.map((tab) => ({ ...tab, panelId: `application-tabpanel-${tab.id}` }))}
          />

          <div
            id={`application-tabpanel-${activeTab}`}
            role="tabpanel"
            tabIndex={0}
            aria-label={tabs.find((tab) => tab.id === activeTab)?.label}
            className="focus-ring-inset p-3.5 sm:p-6"
          >
            {activeTab === "evaluation" && (
              <ProfileTab
                resumeAction={resumeAction}
                editForm={
                  isEditingProfile && profile ? (
                    <ProfileEditForm
                      profile={profile}
                      candidateInitials={candidateInitials}
                      isSaving={updateCandidateMutation.isPending}
                      onCancel={() => setIsEditingProfile(false)}
                      onSave={(dto) => updateCandidateMutation.mutate(dto)}
                    />
                  ) : null
                }
                match={{
                  scores,
                  explanation: scoreExplanation,
                  assessment: parsedAiAssessment,
                  fitScore,
                  requirementsResult,
                }}
                interviews={{
                  interviews: app.interviews || [],
                  scheduleOffer,
                  onSchedule: (type) => openSchedule(type === "FINAL_INTERVIEW" ? InterviewType.FINAL_INTERVIEW : InterviewType.INITIAL_SCREENING),
                  onRecordResult: (interview) => openOutcome(interview, interview.type),
                  onMarkPassed: (interview) =>
                    m.updateInterviewStatus.mutate({
                      interviewId: interview.id,
                      result: "PASS",
                      notes: interview.notes || "Passed interview assessment",
                    }),
                  isMarkingPassed: m.updateInterviewStatus.isPending,
                }}
                background={{ profile, jobPosting: app.jobPosting }}
                personal={!isEditingProfile ? personalDetails : null}
              />
            )}

            {activeTab === "compliance" && (
              <RequirementsTab
                clientReview={{
                  endorsements: (app.clientEndorsements || []) as any,
                  fallbackClientName: linkedClientName,
                  isPastClientReview: flags.isPastClientReview,
                  canRecordDecision: flags.canRecordClientReview,
                  stageBarOwnsDecision: flags.isClientEndorsementStage && flags.isPendingClientReview,
                  onRecordDecision: (end) => {
                    const real = (app.clientEndorsements || []).find((e) => e.id === end.id);
                    if (real) openClientDecision(real, real.outcome === "PENDING");
                  },
                  onRecordMissing: () => setDialog({ kind: "sendToClient", mode: "record" }),
                }}
                isDeployed={app.status === ApplicationStatus.DEPLOYED}
                requirements={requirements}
                counts={requirementCounts}
                showReadiness={flags.isComplianceStage || flags.isContractSigningStage || flags.isTerminal || app.status === ApplicationStatus.DEPLOYED}
                isAllApproved={flags.isAllClearancesApproved}
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
                    onRecordContract={() => setDialog({ kind: "contract" })}
                    onDeployCandidate={() => setDialog({ kind: "deploy" })}
                  />
                }
              />
            )}

            {activeTab === "history" && <ActivityTab events={buildActivity(app, decisions)} isLoading={decisionsQuery.isLoading} />}
          </div>
        </div>

        {resumeBesideContent && (
          <ResumeColumn
            resumeUrl={resumeUrl}
            candidateName={candidateName}
            candidateInitials={candidateInitials}
            onFullscreen={openResumeFullscreen}
            onHide={() => toggleResume(false)}
            topOffset={56 + stageBarHeight + 12}
          />
        )}
      </div>

      {/* Dialogs */}
      <InterviewOutcomeDialog
        open={Boolean(outcomeDialog)}
        onClose={closeDialog}
        candidateName={candidateName}
        jobTitle={jobTitle}
        isFinalInterview={isFinalInterviewStage}
        scheduledAt={outcomeDialog?.interview?.scheduledAt}
        defaultNotes={outcomeDialog?.interview?.notes || ""}
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
        type={dlg?.kind === "schedule" ? dlg.type : InterviewType.INITIAL_SCREENING}
        isReschedule={dlg?.kind === "schedule" ? dlg.isReschedule : false}
        initialDate={dlg?.kind === "schedule" ? dlg.initialDate : ""}
        initialNotes={dlg?.kind === "schedule" ? dlg.initialNotes : ""}
        isSubmitting={m.scheduleInterview.isPending}
        onSubmit={(values) => m.scheduleInterview.mutate(values, { onSuccess: closeDialog })}
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
        requirements={reviewable ? [reviewable] : []}
        initialRequirementId={dlg?.kind === "review" ? dlg.requirementId : null}
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
          previewDocState?.requirementStatus === "APPROVED"
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
      />

      <SignedContractDialog
        open={dlg?.kind === "contract"}
        onClose={closeDialog}
        candidateName={candidateName}
        linkedClientId={linkedClientId}
        linkedClientName={linkedClientName}
        site={defaultSite}
        initialStartDate={app.contractStartDate ? String(app.contractStartDate).slice(0, 10) : addManilaCalendarDays(getManilaToday(), 1)}
        currentCopyDocumentId={app.contractDocumentId}
        onDownloadTemplate={(startDate) => m.downloadContract.mutate(startDate)}
        isDownloading={m.downloadContract.isPending}
        isSubmitting={m.uploadSignedContract.isPending}
        onSubmit={(values) => m.uploadSignedContract.mutate(values, { onSuccess: closeDialog })}
      />
    </div>
  );
};
