import React, { useState, useEffect } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  StatusBadge,
  PipelineIndicator,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { formatDate, getApplicationStatusPresentation } from "../../lib/utils";
import { getPipelineStageIndex } from "../../lib/pipeline-stages";
import { notify } from "../../lib/feedback";
import { ApplicationStatus } from "../../lib/types/enums";
import { ApplicantJobInvitation } from "../../lib/types/applicant.types";
import { getInvitationStatusMeta } from "../../components/applicant/RequirementStatusBadge";
import {
  getApplicationRefetchInterval,
  INVITATION_POLL_MS,
  pollInterval,
} from "../../lib/query-policies";
import { useLiveStreamConnected } from "../../lib/live-stream-status";
import {
  Briefcase,
  Calendar,
  FileText,
  CheckCircle2,
  Bookmark,
  MapPin,
  Mail,
  ArrowRight,
  XCircle,
  MessageSquare,
  AlertCircle,
} from "lucide-react";

export const MyApplicationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { tab?: string };

  const [statusFilter, setStatusFilter] = useState<string>(
    search.tab === "invitations" ? "INVITATIONS" : "ALL"
  );
  const [page, setPage] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const pageSize = 6;

  // Modals & Feedback State for Job Invitations
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<ApplicantJobInvitation | null>(null);
  const [declineReason, setDeclineReason] = useState<
    "SALARY_MISMATCH" | "UNAVAILABLE_EMPLOYED" | "LOCATION_COMMUTE" | "NOT_INTERESTED" | "OTHER"
  >("NOT_INTERESTED");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (search.tab === "invitations") {
      setStatusFilter("INVITATIONS");
      setPage(1);
    }
  }, [search.tab]);

  const streamConnected = useLiveStreamConnected();
  const applicationsQuery = useQuery({
    queryKey: ["applicant", "my-applications"],
    queryFn: ({ signal }) => applicantJobsApi.getMyApplicationSummaries({ summary: true }, { signal }),
    refetchInterval: (query) => getApplicationRefetchInterval(query.state.data, streamConnected),
    refetchOnWindowFocus: true,
  });

  const invitationsQuery = useQuery({
    queryKey: ["applicant", "invitations"],
    queryFn: ({ signal }) => applicantJobsApi.getMyInvitations({ signal }),
    refetchInterval: pollInterval(INVITATION_POLL_MS, streamConnected),
  });

  const respondMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: {
        decision: "ACCEPT" | "DECLINE";
        declineReason?: "SALARY_MISMATCH" | "UNAVAILABLE_EMPLOYED" | "LOCATION_COMMUTE" | "NOT_INTERESTED" | "OTHER";
        notes?: string;
      };
    }) => applicantJobsApi.respondToInvitation(id, body),
    onSuccess: (data, variables) => {
      setAcceptModalOpen(false);
      setDeclineModalOpen(false);
      setSelectedInvitation(null);
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["applicant", "invitations"] });
      queryClient.invalidateQueries({ queryKey: ["applicant", "my-applications"] });

      if (variables.body.decision === "ACCEPT") {
        notify.success("Application Submitted", data.message || "Invitation accepted! Application submitted.");
      } else {
        notify.info("Invitation Declined", "Invitation declined.");
      }
    },
    onError: (err: any) => {
      notify.error("Response Failed", err);
    },
  });

  // Offline, TanStack pauses the fetch and the query stays pending: say so instead of showing a skeleton forever.
  const applicationsOffline = applicationsQuery.fetchStatus === "paused" && applicationsQuery.data === undefined;
  const invitationsOffline = invitationsQuery.fetchStatus === "paused" && invitationsQuery.data === undefined;
  const applicationData = applicationsQuery.data;
  const allApplications = Array.isArray(applicationData) ? applicationData : applicationData?.items ?? [];
  const allInvitations = invitationsQuery.data || [];
  const pendingInvitations = allInvitations.filter((inv) => inv.status === "PENDING");

  // Closed applications and finished placements move to a collapsed history so the main view leads with what is still moving.
  // A deployed application stays in the main list while its placement is scheduled or running: that is the current job.
  const isCurrentAssignment = (app: (typeof allApplications)[number]) =>
    !app.isArchived && app.status === ApplicationStatus.DEPLOYED && !!app.deployments?.length;
  const isClosedApplication = (app: (typeof allApplications)[number]) =>
    app.isArchived ||
    (app.status === ApplicationStatus.DEPLOYED && !isCurrentAssignment(app)) ||
    app.status === ApplicationStatus.ARCHIVED ||
    app.status === ApplicationStatus.BACKOUT ||
    app.status === ApplicationStatus.REJECTED ||
    app.status === ApplicationStatus.TALENT_POOL;
  // The current assignment leads, then newest first.
  const newestFirst = [...allApplications].sort(
    (a, b) =>
      Number(isCurrentAssignment(b)) - Number(isCurrentAssignment(a)) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const openApplications = newestFirst.filter((app) => !isClosedApplication(app));
  const closedApplications = newestFirst.filter(isClosedApplication);
  // With nothing open, the latest closed application still leads so the page is never empty.
  const mainApplications = openApplications.length > 0 ? openApplications : closedApplications.slice(0, 1);
  const historyApplications = openApplications.length > 0 ? closedApplications : closedApplications.slice(1);

  const filteredApplications = (statusFilter === "ALL" ? (showHistory ? [...mainApplications, ...historyApplications] : mainApplications) : allApplications).filter((app) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "ACTIVE") {
      return (
        app.status === ApplicationStatus.SUBMITTED ||
        app.status === ApplicationStatus.PARSING ||
        app.status === ApplicationStatus.REVIEW ||
        app.status === ApplicationStatus.MATCHED
      );
    }
    if (statusFilter === "INTERVIEWS") {
      return (
        app.status === ApplicationStatus.INITIAL_SCREENING ||
        app.status === ApplicationStatus.CLIENT_ENDORSEMENT ||
        app.status === ApplicationStatus.FINAL_INTERVIEW
      );
    }
    if (statusFilter === "COMPLIANCE") {
      return (
        app.status === ApplicationStatus.COMPLIANCE ||
        app.status === ApplicationStatus.CONTRACT_SIGNING
      );
    }
    if (statusFilter === "DEPLOYED") {
      return app.status === ApplicationStatus.DEPLOYED;
    }
    if (statusFilter === "ARCHIVED") {
      return (
        app.status === ApplicationStatus.ARCHIVED ||
        app.status === ApplicationStatus.BACKOUT ||
        app.status === ApplicationStatus.REJECTED ||
        app.isArchived
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const paginatedApplications = filteredApplications.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Counts stay hidden while loading or failed, so no tab reads "0" for data that has not arrived.
  const countOf = (n: number) => (applicationsQuery.isSuccess ? n : undefined);
  const filterTabs = [
    {
      key: "ALL",
      label: "All applications",
      count: countOf(showHistory ? mainApplications.length + historyApplications.length : mainApplications.length),
    },
    {
      key: "ACTIVE",
      label: "In Review",
      count: countOf(allApplications.filter(
        (a) =>
          a.status === ApplicationStatus.SUBMITTED ||
          a.status === ApplicationStatus.PARSING ||
          a.status === ApplicationStatus.REVIEW ||
          a.status === ApplicationStatus.MATCHED
      ).length),
    },
    {
      key: "INTERVIEWS",
      label: "Interviews",
      count: countOf(allApplications.filter(
        (a) =>
          a.status === ApplicationStatus.INITIAL_SCREENING ||
          a.status === ApplicationStatus.CLIENT_ENDORSEMENT ||
          a.status === ApplicationStatus.FINAL_INTERVIEW
      ).length),
    },
    {
      key: "COMPLIANCE",
      label: "Requirements & Contract",
      count: countOf(allApplications.filter(
        (a) =>
          a.status === ApplicationStatus.COMPLIANCE ||
          a.status === ApplicationStatus.CONTRACT_SIGNING
      ).length),
    },
    {
      key: "DEPLOYED",
      label: "Deployed",
      count: countOf(allApplications.filter((a) => a.status === ApplicationStatus.DEPLOYED).length),
    },
    {
      key: "INVITATIONS",
      label: "Job Invitations",
      count: invitationsQuery.isSuccess ? allInvitations.length : undefined,
      pendingCount: pendingInvitations.length,
    },
  ];

  const handleOpenAccept = (inv: ApplicantJobInvitation) => {
    setSelectedInvitation(inv);
    setNotes("");
    setAcceptModalOpen(true);
  };

  const handleOpenDecline = (inv: ApplicantJobInvitation) => {
    setSelectedInvitation(inv);
    setDeclineReason("NOT_INTERESTED");
    setNotes("");
    setDeclineModalOpen(true);
  };

  const handleConfirmAccept = () => {
    if (!selectedInvitation) return;
    respondMutation.mutate({
      id: selectedInvitation.id,
      body: {
        decision: "ACCEPT",
        notes: notes.trim() || undefined,
      },
    });
  };

  const handleConfirmDecline = () => {
    if (!selectedInvitation) return;
    respondMutation.mutate({
      id: selectedInvitation.id,
      body: {
        decision: "DECLINE",
        declineReason,
        notes: notes.trim() || undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My applications"
        description="See your application progress, interviews, and next steps."
        breadcrumbs={[
          { label: "My career", href: "/app" },
          { label: "Applications" },
        ]}
        actions={
          <Link
            to="/app/jobs"
            className="inline-flex min-h-[44px] items-center rounded-md border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 transition-colors"
          >
            Explore jobs
          </Link>
        }
      />

      {/* Filter chips: one scrolling row on phones, wrapped from sm up */}
      <div className="border-b border-slate-200 pb-3">
        <div
          role="group"
          aria-label="Filter applications"
          className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1 sm:flex-wrap sm:overflow-visible"
        >
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            const hasPending = tab.key === "INVITATIONS" && (tab.pendingCount || 0) > 0;

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setStatusFilter(tab.key);
                  setPage(1);
                }}
                className={`min-h-11 md:min-h-9 applicant-touch:min-h-11 shrink-0 whitespace-nowrap px-3.5 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${
                  isActive
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-900 border-slate-200 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 text-xs rounded-md font-semibold tabular-nums ${
                      isActive
                        ? "bg-white/20 text-white"
                        : hasPending
                        ? "bg-[#FFF7ED] text-[#B45309] border border-[#FED7AA]"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* View Branch: Job Invitations */}
      {statusFilter === "INVITATIONS" ? (
        invitationsOffline || invitationsQuery.isError ? (
          <ErrorState
            subject="invitations"
            error={invitationsOffline ? undefined : invitationsQuery.error}
            onRetry={() => invitationsQuery.refetch()}
          />
        ) : invitationsQuery.isPending ? (
          <LoadingState variant="cards" rows={3} className="md:grid-cols-1! lg:grid-cols-1!" />
        ) : allInvitations.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-md shadow-xs">
            <EmptyState
              bare
              icon={<Mail className="w-8 h-8 text-slate-400" />}
              title="No job invitations right now"
              description="When recruiters match your profile to open positions, direct invitations will appear here for you to accept or decline."
              action={
                <Button asChild variant="primary" size="sm">
                  <Link to="/app/jobs">
                    Explore Open Jobs
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {allInvitations.map((inv) => {
              const isPending = inv.status === "PENDING";
              const statusMeta = getInvitationStatusMeta(inv.status);

              return (
                <div
                  key={inv.id}
                  className={`bg-white rounded-md border p-5 shadow-xs transition-all space-y-4 ${
                    isPending ? "border-slate-900/40 ring-1 ring-slate-900/20" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 pb-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-base font-bold text-slate-900">{inv.title}</h3>
                        <span className={statusMeta.className}>
                          <statusMeta.Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#486581]">
                        {inv.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                            <span>{inv.location}</span>
                          </span>
                        )}
                        <span>Received {formatDate(inv.createdAt)}</span>
                        {inv.expiresAt && isPending && (
                          <span className="text-[#B45309] font-semibold">
                            Expires {formatDate(inv.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDecline(inv)}
                          leftIcon={<XCircle className="w-3.5 h-3.5" />}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenAccept(inv)}
                          leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        >
                          Accept & Apply
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Recruiter Message */}
                  {inv.message && (
                    <div className="p-3 bg-slate-100 border border-slate-200 rounded-md text-sm space-y-1">
                      <div className="text-slate-900 font-semibold flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-900" aria-hidden="true" />
                        <span>Note from Recruiter ({inv.invitedBy || "Talent Acquisition"})</span>
                      </div>
                      <p className="text-slate-900 leading-relaxed italic">"{inv.message}"</p>
                    </div>
                  )}

                  {/* Job Description & Requirements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm leading-relaxed">
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">
                        Role Overview
                      </h4>
                      <p className="text-[#486581] whitespace-pre-line line-clamp-3">
                        {inv.description}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">
                        Key Qualifications
                      </h4>
                      <p className="text-[#486581] whitespace-pre-line line-clamp-3">
                        {inv.requirements}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* View Branch: Standard Job Applications */
        applicationsOffline || applicationsQuery.isError ? (
          <ErrorState
            subject="applications"
            error={applicationsOffline ? undefined : applicationsQuery.error}
            onRetry={() => applicationsQuery.refetch()}
          />
        ) : applicationsQuery.isPending ? (
          <LoadingState variant="cards" rows={3} className="md:grid-cols-1! lg:grid-cols-1!" />
        ) : allApplications.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-md shadow-xs">
            <EmptyState
              bare
              icon={<Briefcase className="w-5 h-5 text-slate-400" />}
              title="No applications yet"
              description="Explore current jobs and apply when a role suits you."
              action={
                <Button asChild variant="primary" size="sm">
                  <Link to="/app/jobs">Explore jobs</Link>
                </Button>
              }
            />
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-md shadow-xs">
            <EmptyState
              bare
              icon={<Briefcase className="w-5 h-5 text-slate-400" />}
              title="No applications in this category"
              description="There are currently no job applications matching this filter category."
              action={
                <Button variant="outline" size="sm" onClick={() => setStatusFilter("ALL")}>
                  View All Applications
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white border border-slate-200 p-5 space-y-4 hover:border-slate-400 transition-all rounded-md shadow-xs hover:shadow-sm"
              >
                {/* Top line: role title, company & date */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    {isCurrentAssignment(app) && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Current assignment</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {app.jobPosting?.title || `Position reference #${app.jobPostingId}`}
                      </h3>
                      <StatusBadge status={app.status} audience="applicant" />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-[#486581]">
                      <span className="whitespace-nowrap font-mono font-medium text-slate-700">App #{app.id}</span>
                      {app.jobPosting?.mrf?.client?.name && (
                        <span className="font-medium text-slate-700">{app.jobPosting.mrf.client.name}</span>
                      )}
                      <span className="whitespace-nowrap">Applied {formatDate(app.createdAt)}</span>
                      {app.jobPosting?.location && (
                        <span className="inline-flex min-w-0 max-w-full items-center gap-1" title={app.jobPosting.location}>
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="truncate">{app.jobPosting.location}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    to="/app/applications/$applicationId"
                    params={{ applicationId: String(app.id) }}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 md:min-h-9 applicant-touch:min-h-11 sm:shrink-0 transition-colors"
                  >
                    View application progress
                  </Link>
                </div>

                {/* One line, "Step N of 7: <stage>". The stepper itself lives on the detail page. */}
                {getPipelineStageIndex(app.status) >= 0 && (
                  <PipelineIndicator
                    variant="compact"
                    currentStatus={app.status}
                    currentLabel={getApplicationStatusPresentation(app.status, "applicant").label}
                    audience="applicant"
                    hideTerminalAlert
                    skipClientReview={app.jobPosting?.mrf?.requiresClientReview === false}
                    className="border-t border-slate-200 pt-3 [&>div]:block! [&>ol]:hidden"
                  />
                )}

                {/* Contextual Status Alerts */}
                {app.status === ApplicationStatus.INITIAL_SCREENING && (
                  <div className="p-3 bg-[#EAF0F7] border border-[#D9E2EC] rounded-md flex items-start gap-2 text-sm text-slate-900">
                    <Calendar className="w-4 h-4 text-[#0B315D] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Your screening interview has been queued. Our recruitment team will coordinate with you regarding the schedule.
                    </span>
                  </div>
                )}

                {app.status === ApplicationStatus.FINAL_INTERVIEW && (
                  <div className="p-3 bg-[#EAF0F7] border border-[#D9E2EC] rounded-md flex items-start gap-2 text-sm text-slate-900">
                    <Calendar className="w-4 h-4 text-[#0B315D] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      You have advanced to the client final interview. Please prepare for your scheduled discussion.
                    </span>
                  </div>
                )}

                {app.status === ApplicationStatus.COMPLIANCE && (
                  <div className="p-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-md flex flex-col gap-2 text-sm text-slate-900 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        Requirements are needed. Please submit the documents requested for you.
                      </span>
                    </div>
                    <Link
                      to="/app/applications/$applicationId"
                      params={{ applicationId: String(app.id) }}
                      className="inline-flex min-h-11 items-center font-medium text-[#B45309] underline-offset-2 hover:underline md:min-h-9 applicant-touch:min-h-11 sm:shrink-0"
                    >
                      Submit documents
                    </Link>
                  </div>
                )}

                {app.status === ApplicationStatus.DEPLOYED && (
                  <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-md flex items-start gap-2 text-sm text-slate-900">
                    <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      You have been placed at your work site. Your employee record is ready.
                    </span>
                  </div>
                )}

                {app.status === ApplicationStatus.TALENT_POOL && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col gap-2 text-sm text-slate-900 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex items-start gap-2">
                      <Bookmark className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications.
                      </span>
                    </div>
                    <Link
                      to="/app/applications/$applicationId"
                      params={{ applicationId: String(app.id) }}
                      className="inline-flex min-h-11 items-center font-medium text-slate-900 underline-offset-2 hover:underline md:min-h-9 applicant-touch:min-h-11 sm:shrink-0"
                    >
                      View details
                    </Link>
                  </div>
                )}
              </div>
            ))}

            {statusFilter === "ALL" && historyApplications.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowHistory((value) => !value);
                  setPage(1);
                }}
                aria-expanded={showHistory}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
              >
                {showHistory
                  ? "Hide earlier applications"
                  : `Show earlier applications (${historyApplications.length})`}
              </button>
            )}

            {/* Pagination: only when there is more than one page */}
            {totalPages > 1 && (
              <div className="bg-white border border-slate-200 p-2 rounded-md shadow-xs">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filteredApplications.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  itemLabel="applications"
                />
              </div>
            )}
          </div>
        )
      )}

      {/* Accept Confirmation Modal */}
      <Dialog
        open={acceptModalOpen}
        onClose={() => setAcceptModalOpen(false)}
        title="Accept Job Invitation"
        description={`Submit your job application for ${selectedInvitation?.title}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-md text-sm text-slate-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#047857]" aria-hidden="true" />
              <span>Ready to submit your application?</span>
            </div>
            <p className="text-[#486581] leading-relaxed">
              Your profile information and resume on file will be submitted directly to the Talent Acquisition team for immediate review.
            </p>
          </div>

          <Textarea
            label="Optional Note to Recruiter"
            placeholder="e.g. Excited for this opportunity! I am available to start immediately..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAcceptModalOpen(false)}
              disabled={respondMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={respondMutation.isPending}
              onClick={handleConfirmAccept}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Confirm & Submit Application
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Decline Modal */}
      <Dialog
        open={declineModalOpen}
        onClose={() => setDeclineModalOpen(false)}
        title="Decline Job Invitation"
        description={`Decline invitation for ${selectedInvitation?.title}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              Please let us know why you are declining so we can match you with better opportunities in the future.
            </span>
          </div>

          <Select
            label="Reason for Declining *"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value as any)}
            options={[
              { value: "NOT_INTERESTED", label: "Not interested in this role" },
              { value: "UNAVAILABLE_EMPLOYED", label: "Currently employed / No longer looking" },
              { value: "SALARY_MISMATCH", label: "Compensation / Salary mismatch" },
              { value: "LOCATION_COMMUTE", label: "Location / Commute distance" },
              { value: "OTHER", label: "Other reason" },
            ]}
          />

          <Textarea
            label="Additional Feedback (Optional)"
            placeholder="Provide any additional context..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeclineModalOpen(false)}
              disabled={respondMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={respondMutation.isPending}
              onClick={handleConfirmDecline}
            >
              Confirm Decline
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
