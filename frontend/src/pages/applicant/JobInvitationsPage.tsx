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
import { ApplicantJobInvitation } from "../../lib/types/applicant.types";
import {
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertCircle,
  ArrowRight,
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

  const invitationsQuery = useQuery({
    queryKey: ["applicant", "invitations"],
    queryFn: applicantJobsApi.getMyInvitations,
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

  const getStatusBadge = (status: string) => {
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
        title="Job Invitations"
        description="Direct invitations from Talent Acquisition based on your verified skills and qualifications"
        breadcrumbs={[
          { label: "My Applications", href: "/app/my-applications" },
          { label: "Job Invitations" },
        ]}
      />

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-[#E8EEF6] border-[#0F294A]/20 text-[#0F294A]"
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

      {invitationsQuery.isLoading ? (
        <LoadingState variant="cards" />
      ) : invitationsQuery.isError ? (
        <ErrorState error={invitationsQuery.error} onRetry={() => invitationsQuery.refetch()} />
      ) : invitations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <EmptyState
            icon={<Mail className="w-8 h-8 text-slate-400" />}
            title="No job invitations right now"
            description="When recruiters match your profile to open positions, invitations will appear here for you to accept or decline."
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
          {invitations.map((inv) => {
            const isPending = inv.status === "PENDING";

            return (
              <div
                key={inv.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-all space-y-4 ${
                  isPending ? "border-[#0F294A]/30 ring-1 ring-[#0F294A]/20" : "border-slate-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{inv.title}</h3>
                      {getStatusBadge(inv.status)}
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
                  <div className="p-3 bg-[#E8EEF6]/60 border border-[#0F294A]/20 rounded-lg text-xs space-y-1">
                    <div className="text-[#0F294A] font-semibold flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#0F294A]" />
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
