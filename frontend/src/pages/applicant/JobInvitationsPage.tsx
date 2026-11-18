import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/common";
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { notify } from "../../lib/feedback";
import { INVITATION_POLL_MS, pollInterval } from "../../lib/query-policies";
import { useLiveStreamConnected } from "../../lib/live-stream-status";
import { ApplicantJobInvitation } from "../../lib/types/applicant.types";
import { getInvitationStatusMeta } from "../../components/applicant/RequirementStatusBadge";
import {
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export const JobInvitationsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<ApplicantJobInvitation | null>(null);

  const [declineReason, setDeclineReason] = useState<
    "SALARY_MISMATCH" | "UNAVAILABLE_EMPLOYED" | "LOCATION_COMMUTE" | "NOT_INTERESTED" | "OTHER"
  >("NOT_INTERESTED");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const streamConnected = useLiveStreamConnected();
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

  const invitations = invitationsQuery.data || [];

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
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Job Invitations"
        description="Direct invitations from Talent Acquisition based on your verified skills and qualifications"
        breadcrumbs={[
          { label: "My career", href: "/app" },
          { label: "My Applications", href: "/app/applications" },
          { label: "Job Invitations" },
        ]}
      />

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-sm flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-slate-50 border-slate-200 text-[#0B315D]"
              : "bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]"
          }`}
        >
          <span className="min-w-0 [overflow-wrap:anywhere]">{feedback.message}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setFeedback(null)}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-[#486581] hover:bg-white/60 hover:text-[#102A43] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
          >
            ×
          </button>
        </div>
      )}

      {invitationsQuery.isLoading ? (
        <LoadingState variant="cards" />
      ) : invitationsQuery.isError ? (
        <ErrorState error={invitationsQuery.error} onRetry={() => invitationsQuery.refetch()} />
      ) : invitations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <EmptyState
            bare
            icon={<Mail className="w-8 h-8 text-[#486581]" />}
            title="No job invitations right now"
            description="When recruiters match your profile to open positions, invitations will appear here for you to accept or decline."
            action={
              <Button asChild variant="primary" size="md">
                <Link to="/app/jobs">Browse Open Jobs</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {invitations.map((inv) => {
            const isPending = inv.status === "PENDING";
            const statusMeta = getInvitationStatusMeta(inv.status);

            return (
              <div
                key={inv.id}
                className={`min-w-0 bg-white rounded-xl border p-5 transition-colors space-y-4 [overflow-wrap:anywhere] ${
                  isPending ? "border-[#0B315D]/50 ring-1 ring-[#0B315D]/15" : "border-slate-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-[#0B315D]">
                        <Link
                          to="/app/jobs/$jobId"
                          params={{ jobId: String(inv.jobPostingId) }}
                          className="inline-flex min-h-11 items-center rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 md:min-h-0 applicant-touch:min-h-11 break-words"
                        >
                          {inv.title}
                        </Link>
                      </h2>
                      <span className={statusMeta.className}>
                        <statusMeta.Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#486581]">
                      {inv.location && (
                        <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#486581] shrink-0" aria-hidden="true" />
                          <span className="truncate">{inv.location}</span>
                        </span>
                      )}
                      <span className="whitespace-nowrap">Received {formatDate(inv.createdAt)}</span>
                      {inv.expiresAt && isPending && (
                        <span className="text-[#B45309] font-semibold whitespace-nowrap">
                          Expires {formatDate(inv.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                      to="/app/jobs/$jobId"
                      params={{ jobId: String(inv.jobPostingId) }}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-[#0B315D] hover:bg-slate-50 hover:text-[#082747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 transition-colors md:min-h-9 applicant-touch:min-h-11"
                    >
                      <span>View Job</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </Link>
                    {isPending && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 md:min-h-9 applicant-touch:min-h-11"
                          onClick={() => handleOpenDecline(inv)}
                          leftIcon={<XCircle className="w-3.5 h-3.5 text-[#DC2626]" />}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          className="min-h-11 md:min-h-9 applicant-touch:min-h-11"
                          onClick={() => handleOpenAccept(inv)}
                          leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        >
                          Accept & Apply
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Recruiter Message */}
                {inv.message && (
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-sm space-y-1">
                    <div className="text-[#0B315D] font-semibold flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#0B315D]" aria-hidden="true" />
                      <span>Note from Recruiter ({inv.invitedBy || "Talent Acquisition"})</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed italic">"{inv.message}"</p>
                  </div>
                )}

                {/* Job Description & Requirements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm leading-relaxed">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#0B315D] mb-1">
                      Role Overview
                    </h3>
                    <p className="text-[#486581] whitespace-pre-line line-clamp-3">
                      {inv.description}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#0B315D] mb-1">
                      Key Qualifications
                    </h3>
                    <p className="text-[#486581] whitespace-pre-line line-clamp-3">
                      {inv.requirements}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accept Confirmation Modal */}
      <Dialog
        open={acceptModalOpen}
        onClose={() => setAcceptModalOpen(false)}
        title="Accept Job Invitation"
        description={`Submit your job application for ${selectedInvitation?.title}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-[#ECFDF5] border border-[#047857]/20 rounded-lg text-xs text-[#047857] space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#047857]" />
              <span>Ready to submit your application?</span>
            </div>
            <p className="text-[#627D98] leading-relaxed">
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

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setAcceptModalOpen(false)} disabled={respondMutation.isPending}>
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
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-[#102A43] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#627D98] shrink-0 mt-0.5" />
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

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setDeclineModalOpen(false)} disabled={respondMutation.isPending}>
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
