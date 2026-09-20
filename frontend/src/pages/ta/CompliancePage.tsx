import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  StatusBadge,
} from "../../components/common";
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
import { ShieldCheck } from "lucide-react";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";

export const CompliancePage: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const queryClient = useQueryClient();

  const [reviewReqId, setReviewReqId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewNotes, setReviewNotes] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [queuePage, setQueuePage] = useState(1);
  const queuePageSize = 8;

  const complianceAnalyticsQuery = useQuery({
    queryKey: ["ta", "analytics", "compliance"],
    queryFn: taApi.getComplianceOverview,
  });

  const applicationsQuery = useQuery({
    queryKey: ["ta", "applications", "compliance-queue"],
    queryFn: () => taApi.listApplications({ limit: 100 }),
  });

  const rawApps = Array.isArray(applicationsQuery.data)
    ? applicationsQuery.data
    : applicationsQuery.data?.data || [];

  const complianceApps = rawApps.filter(
    (a) => a.status === ApplicationStatus.COMPLIANCE
  );

  const totalQueuePages = Math.max(1, Math.ceil(complianceApps.length / queuePageSize));
  const paginatedApps = complianceApps.slice(
    (queuePage - 1) * queuePageSize,
    queuePage * queuePageSize
  );

  const reviewComplianceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { reviewStatus: "APPROVED" | "REJECTED"; reviewNotes?: string } }) =>
      taApi.reviewComplianceRequirement(id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta"] });
      setReviewReqId(null);
      setReviewNotes("");
      const msg = vars.data.reviewStatus === "APPROVED"
        ? "The requirement was approved."
        : "The requirement was rejected and needs correction.";
      setFeedback({ type: "success", message: msg });
      notify.success("Review saved", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to save this review. Please try again." });
      notify.error("Review failed", err);
    },
  });

  if (complianceAnalyticsQuery.isLoading) {
    return (
      <div className="space-y-6">
        {!hideHeader && <PageHeader title={TA_COPY.navigation.workforce} description="Loading pre-employment requirements..." />}
        <LoadingState variant="table" rows={6} />
      </div>
    );
  }

  if (complianceAnalyticsQuery.isError) {
    return (
      <div className="space-y-6">
        {!hideHeader && <PageHeader title={TA_COPY.navigation.workforce} description="Pre-employment requirements" />}
        <ErrorState
          error={complianceAnalyticsQuery.error}
          onRetry={() => complianceAnalyticsQuery.refetch()}
        />
      </div>
    );
  }

  const overview = complianceAnalyticsQuery.data;
  const breakdown = overview?.statusBreakdown || {};
  const total = overview?.totalRequirements || 0;
  const pending = breakdown["PENDING"] || 0;
  const submitted = breakdown["SUBMITTED"] || 0;
  const approved = breakdown["APPROVED"] || 0;

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <PageHeader
          title="Pre-employment requirements"
          description="Review required documents before a candidate starts at a client site."
          breadcrumbs={[
            { label: TA_COPY.navigation.overview, href: "/ta" },
            { label: TA_COPY.navigation.workforce },
          ]}
        />
      )}

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
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
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Compliance Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-600">
            Requirements tracked
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Across active candidates
          </div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-xs bg-amber-50/20">
          <div className="text-xs font-semibold text-amber-800">
            Waiting for candidate
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900 mt-1 tabular-nums">
            {pending}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 font-mono">
            Candidate still needs to submit
          </div>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-xs bg-blue-50/20">
          <div className="text-xs font-semibold text-blue-800">
            Waiting for review
          </div>
          <div className="text-2xl font-bold font-mono text-blue-900 mt-1 tabular-nums">
            {submitted}
          </div>
          <div className="text-[11px] text-blue-700 mt-1 font-mono">
            TA review needed
          </div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs bg-emerald-50/20">
          <div className="text-xs font-semibold text-emerald-800">
            Approved
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900 mt-1 tabular-nums">
            {approved}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-mono">
            Ready for deployment
          </div>
        </div>
      </div>


      {/* Active Compliance Verification Queue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-mono uppercase">
              Requirements waiting for review
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Candidates with documents that need checking
            </p>
          </div>
          <Link to="/ta/applications">
            <Button variant="outline" size="sm">
              View applications
            </Button>
          </Link>
        </div>

        {applicationsQuery.isLoading ? (
          <LoadingState variant="table" rows={4} />
        ) : complianceApps.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
              title="No requirements need review"
              description="All active candidates are either waiting to submit documents or have already been reviewed."
            />
          </div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-slate-200">
            {paginatedApps.map((app) => {
              const profile = app.user?.applicantProfile;
              const candidateName = profile ? `${profile.firstName} ${profile.lastName}` : app.user?.email || "Candidate";
              return (
                <article key={app.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-slate-950 break-words">{candidateName}</h4>
                      <p className="mt-0.5 text-sm text-slate-600 break-words">{app.jobPosting?.title || "Job opening"}</p>
                    </div>
                    <StatusBadge status={app.status} size="sm" />
                  </div>
                  <p className="text-sm text-slate-600">Submitted {formatDate(app.createdAt)}</p>
                  <Link
                    to="/ta/applications/$applicationId"
                    params={{ applicationId: String(app.id) }}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                  >
                    Review requirements
                  </Link>
                </article>
              );
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Candidate</th>
                  <th className="px-4 py-3 font-semibold">Job opening</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedApps.map((app) => {
                  const p = app.user?.applicantProfile;
                  const candidateName = p
                    ? `${p.firstName} ${p.lastName}`
                    : app.user?.email || "Candidate";

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 font-sans">{candidateName}</div>
                        <div className="text-xs text-slate-500">
                          Application #{app.id} • {app.user?.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-sans">
                        <div className="font-semibold">{app.jobPosting?.title || "Job opening"}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {app.jobPosting?.location || "Philippines"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={app.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <Link
                          to="/ta/applications/$applicationId"
                          params={{ applicationId: String(app.id) }}
                        >
                          <Button variant="outline" size="sm">
                            Review requirements
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Queue Pagination */}
        {complianceApps.length > queuePageSize && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Pagination
              currentPage={queuePage}
              totalPages={totalQueuePages}
              totalItems={complianceApps.length}
              pageSize={queuePageSize}
              onPageChange={setQueuePage}
              itemLabel="clearances"
            />
          </div>
        )}
      </div>

      {/* Review Modal */}
      <Dialog
        open={Boolean(reviewReqId)}
        onClose={() => setReviewReqId(null)}
        title="Review requirement"
        description="Check the candidate’s document and record your decision."
      >
        <div className="space-y-4">
          <Select
            label="Review decision"
            value={reviewStatus}
            onChange={(e) => setReviewStatus(e.target.value as any)}
            options={[
              { value: "APPROVED", label: "Approve — document is valid" },
              { value: "REJECTED", label: "Reject — document needs correction" },
            ]}
          />
          <Textarea
            label="Notes for the candidate"
            placeholder="Explain what was verified or what needs to be corrected..."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setReviewReqId(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewStatus === "APPROVED" ? "primary" : "danger"}
              size="sm"
              loading={reviewComplianceMutation.isPending}
              onClick={() => {
                if (reviewReqId) {
                  reviewComplianceMutation.mutate({
                    id: reviewReqId,
                    data: {
                      reviewStatus,
                      reviewNotes: reviewNotes || undefined,
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
    </div>
  );
};
