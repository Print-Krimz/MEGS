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
import { formatDate } from "../../lib/utils";
import { notify } from "../../lib/feedback";
import { ApplicationStatus } from "../../lib/types/enums";
import { ApplicantJobInvitation } from "../../lib/types/applicant.types";
import {
  Briefcase,
  Calendar,
  FileText,
  CheckCircle2,
  Bookmark,
  MapPin,
  Mail,
  ArrowRight,
  Clock,
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
  const pageSize = 6;

  // Modals & Feedback State for Job Invitations
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<ApplicantJobInvitation | null>(null);
  const [declineReason, setDeclineReason] = useState<
    "SALARY_MISMATCH" | "UNAVAILABLE_EMPLOYED" | "LOCATION_COMMUTE" | "NOT_INTERESTED" | "OTHER"
  >("NOT_INTERESTED");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (search.tab === "invitations") {
      setStatusFilter("INVITATIONS");
      setPage(1);
    }
  }, [search.tab]);

  const applicationsQuery = useQuery({
    queryKey: ["applicant", "my-applications"],
    queryFn: applicantJobsApi.getMyApplications,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const invitationsQuery = useQuery({
    queryKey: ["applicant", "invitations"],
    queryFn: applicantJobsApi.getMyInvitations,
    refetchInterval: 10000,
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
        const msg = data.message || "Invitation accepted! Application submitted.";
        setFeedback({ type: "success", message: msg });
        notify.success("Application Submitted", msg);
      } else {
        const msg = "Invitation declined.";
        setFeedback({ type: "success", message: msg });
        notify.info("Invitation Declined", msg);
      }
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err.message || "Failed to respond to invitation" });
      notify.error("Response Failed", err);
    },
  });

  const allApplications = applicationsQuery.data || [];
  const allInvitations = invitationsQuery.data || [];
  const pendingInvitations = allInvitations.filter((inv) => inv.status === "PENDING");

  const filteredApplications = allApplications.filter((app) => {
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
        app.status === ApplicationStatus.CONTRACT_AND_ORIENTATION
      );
    }
    if (statusFilter === "DEPLOYED") {
      return app.status === ApplicationStatus.DEPLOYED;
    }
    if (statusFilter === "ARCHIVED") {
      return (
        app.status === ApplicationStatus.ARCHIVED ||
        app.status === ApplicationStatus.BACKOUT ||
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

  const filterTabs = [
    { key: "ALL", label: "All applications", count: allApplications.length },
    {
      key: "ACTIVE",
      label: "In Review",
      count: allApplications.filter(
        (a) =>
          a.status === ApplicationStatus.SUBMITTED ||
          a.status === ApplicationStatus.PARSING ||
          a.status === ApplicationStatus.REVIEW ||
          a.status === ApplicationStatus.MATCHED
      ).length,
    },
    {
      key: "INTERVIEWS",
      label: "Interviews",
      count: allApplications.filter(
        (a) =>
          a.status === ApplicationStatus.INITIAL_SCREENING ||
          a.status === ApplicationStatus.CLIENT_ENDORSEMENT ||
          a.status === ApplicationStatus.FINAL_INTERVIEW
      ).length,
    },
    {
      key: "COMPLIANCE",
      label: "Requirements & Onboarding",
      count: allApplications.filter(
        (a) =>
          a.status === ApplicationStatus.COMPLIANCE ||
          a.status === ApplicationStatus.CONTRACT_AND_ORIENTATION
      ).length,
    },
    {
      key: "DEPLOYED",
      label: "Deployed",
      count: allApplications.filter((a) => a.status === ApplicationStatus.DEPLOYED).length,
    },
    {
      key: "INVITATIONS",
      label: "Job Invitations",
      count: allInvitations.length,
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

  const getInvitationStatusBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>ACCEPTED</span>
          </span>
        );
      case "DECLINED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>DECLINED</span>
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>EXPIRED</span>
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200">
            <span>CANCELLED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Mail className="w-3.5 h-3.5 text-amber-600" />
            <span>ACTION REQUIRED</span>
          </span>
        );
    }
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
            className="inline-flex min-h-11 items-center rounded-md border border-teal-800 bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            Explore jobs
          </Link>
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
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter Tabs Ribbon */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-300 pb-2">
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          const hasPending = tab.key === "INVITATIONS" && (tab.pendingCount || 0) > 0;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={`min-h-11 px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                isActive
                  ? "bg-teal-700 text-white border border-teal-800"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 text-xs rounded-full font-mono font-semibold ${
                  isActive
                    ? "bg-teal-900 text-teal-100"
                    : hasPending
                    ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* View Branch: Job Invitations */}
      {statusFilter === "INVITATIONS" ? (
        invitationsQuery.isLoading ? (
          <LoadingState variant="cards" />
        ) : invitationsQuery.isError ? (
          <ErrorState
            error={invitationsQuery.error}
            onRetry={() => invitationsQuery.refetch()}
          />
        ) : allInvitations.length === 0 ? (
          <div className="bg-white border border-slate-300 p-8 text-center rounded-lg shadow-xs">
            <EmptyState
              icon={<Mail className="w-8 h-8 text-slate-400" />}
              title="No job invitations right now"
              description="When recruiters match your profile to open positions, direct invitations will appear here for you to accept or decline."
              action={
                <Link to="/app/jobs">
                  <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    Explore Open Jobs
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {allInvitations.map((inv) => {
              const isPending = inv.status === "PENDING";

              return (
                <div
                  key={inv.id}
                  className={`bg-white rounded-xl border p-5 shadow-xs transition-all space-y-4 ${
                    isPending ? "border-teal-300 ring-1 ring-teal-200" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{inv.title}</h3>
                        {getInvitationStatusBadge(inv.status)}
                      </div>
                      <div className="text-xs text-slate-500 font-mono flex items-center gap-3 mt-1">
                        {inv.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{inv.location}</span>
                          </span>
                        )}
                        <span>•</span>
                        <span>Received {formatDate(inv.createdAt)}</span>
                        {inv.expiresAt && isPending && (
                          <>
                            <span>•</span>
                            <span className="text-amber-700 font-semibold">
                              Expires {formatDate(inv.expiresAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDecline(inv)}
                          leftIcon={<XCircle className="w-3.5 h-3.5 text-rose-500" />}
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
                    <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-lg text-xs space-y-1">
                      <div className="text-teal-900 font-semibold flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                        <span>Note from Recruiter ({inv.invitedBy || "Talent Acquisition"})</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed italic">"{inv.message}"</p>
                    </div>
                  )}

                  {/* Job Description & Requirements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                    <div>
                      <h4 className="font-mono font-bold text-slate-700 uppercase mb-1">
                        Role Overview
                      </h4>
                      <p className="text-slate-600 whitespace-pre-line line-clamp-3">
                        {inv.description}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-mono font-bold text-slate-700 uppercase mb-1">
                        Key Qualifications
                      </h4>
                      <p className="text-slate-600 whitespace-pre-line line-clamp-3">
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
        applicationsQuery.isLoading ? (
          <LoadingState variant="table" rows={5} />
        ) : applicationsQuery.isError ? (
          <ErrorState
            error={applicationsQuery.error}
            onRetry={() => applicationsQuery.refetch()}
          />
        ) : allApplications.length === 0 ? (
          <div className="bg-white border border-slate-300 p-6">
            <EmptyState
              icon={<Briefcase className="w-5 h-5" />}
              title="No applications yet"
              description="Explore current jobs and apply when a role suits you."
              action={
                <Link
                  to="/app/jobs"
                  className="inline-flex min-h-11 items-center rounded-md border border-teal-800 bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                >
                  Explore jobs
                </Link>
              }
            />
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="bg-white border border-slate-300 p-6">
            <EmptyState
              icon={<Briefcase className="w-5 h-5" />}
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
                className="bg-white border border-slate-300 p-5 space-y-4 hover:border-slate-400 transition-colors rounded-lg shadow-xs"
              >
                {/* Top line: role title, company & date */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950">
                        {app.jobPosting?.title || `Position reference #${app.jobPostingId}`}
                      </h3>
                      <StatusBadge status={app.status} audience="applicant" />
                    </div>
                    <div className="text-sm text-slate-600 font-mono flex items-center gap-4">
                      <span>App #{app.id}</span>
                      <span>•</span>
                      <span>Applied on {formatDate(app.createdAt)}</span>
                      {app.jobPosting?.location && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-sans">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {app.jobPosting.location}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <Link
                    to="/app/applications/$applicationId"
                    params={{ applicationId: String(app.id) }}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 shrink-0"
                  >
                    View application progress
                  </Link>
                </div>

                {/* Pipeline Stepper */}
                <div className="pt-2 border-t border-slate-200">
                  <PipelineIndicator currentStatus={app.status} audience="applicant" hideTerminalAlert />
                </div>

                {/* Contextual Status Alerts */}
                {app.status === ApplicationStatus.INITIAL_SCREENING && (
                  <div className="p-3 bg-teal-50 border-l-4 border-teal-700 border border-slate-300 flex items-center gap-2 text-sm text-teal-950">
                    <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>
                      Your screening interview has been queued. Our recruitment team will coordinate with you regarding the schedule.
                    </span>
                  </div>
                )}

                {app.status === ApplicationStatus.FINAL_INTERVIEW && (
                  <div className="p-3 bg-teal-50 border-l-4 border-teal-700 border border-slate-300 flex items-center gap-2 text-sm text-teal-950">
                    <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>
                      You have advanced to the client final interview. Please prepare for your scheduled discussion.
                    </span>
                  </div>
                )}

                {app.status === ApplicationStatus.COMPLIANCE && (
                  <div className="p-3 bg-amber-50 border-l-4 border-amber-600 border border-slate-300 flex items-center justify-between gap-3 text-sm text-amber-950">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        Employment documents (201) are needed. Please submit the documents requested for you.
                      </span>
                    </div>
                    <Link
                      to="/app/applications/$applicationId"
                      params={{ applicationId: String(app.id) }}
                    >
                      <span className="font-medium text-amber-900 hover:underline shrink-0">
                        Submit documents
                      </span>
                    </Link>
                  </div>
                )}

                {app.status === ApplicationStatus.DEPLOYED && (
                  <div className="p-3 bg-emerald-50 border-l-4 border-emerald-700 border border-slate-300 flex items-center gap-2 text-sm text-emerald-950">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      You have been placed at your work site. Your employee record is ready.
                    </span>
                  </div>
                )}

                {app.status === ApplicationStatus.TALENT_POOL && (
                  <div className="p-3 bg-violet-50 border-l-4 border-violet-700 border border-slate-300 flex items-center justify-between gap-3 text-sm text-violet-950">
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-violet-700 shrink-0" />
                      <span>
                        You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications.
                      </span>
                    </div>
                    <Link
                      to="/app/applications/$applicationId"
                      params={{ applicationId: String(app.id) }}
                    >
                      <span className="font-medium text-violet-900 hover:underline shrink-0">
                        View details
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            <div className="bg-white border border-slate-300 p-2">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredApplications.length}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </div>
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
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Ready to submit your application?</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
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
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2">
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
