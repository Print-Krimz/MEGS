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
} from "../../components/common";
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
import { ShieldCheck } from "lucide-react";

export const CompliancePage: React.FC = () => {
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
    (a) =>
      a.status === ApplicationStatus.COMPLIANCE ||
      a.status === ApplicationStatus.HIRED ||
      a.status === ApplicationStatus.ONBOARDING
  );

  const totalQueuePages = Math.max(1, Math.ceil(complianceApps.length / queuePageSize));
  const paginatedApps = complianceApps.slice(
    (queuePage - 1) * queuePageSize,
    queuePage * queuePageSize
  );

  const reviewComplianceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { reviewStatus: "APPROVED" | "REJECTED"; reviewNotes?: string } }) =>
      taApi.reviewComplianceRequirement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta"] });
      setReviewReqId(null);
      setReviewNotes("");
      setFeedback({ type: "success", message: "Compliance document review recorded." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to record compliance review: " + err.message });
    },
  });

  if (complianceAnalyticsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="201 Compliance Tracking" description="Loading compliance statistics..." />
        <LoadingState variant="table" rows={6} />
      </div>
    );
  }

  if (complianceAnalyticsQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="201 Compliance Tracking" description="Pre-employment verification" />
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
      <PageHeader
        title="201 Pre-Employment Compliance Tracking"
        description="Verify government clearances (NBI, SSS, PhilHealth, Pag-IBIG, Medical) prior to field site deployment"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Compliance Tracking" },
        ]}
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

      {/* Compliance Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-mono font-bold text-slate-500 uppercase">
            Total Clearances Tracked
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Across active applications
          </div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-xs bg-amber-50/20">
          <div className="text-[11px] font-mono font-bold text-amber-800 uppercase">
            Pending / Awaiting Upload
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900 mt-1 tabular-nums">
            {pending}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 font-mono">
            Candidates notified
          </div>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-xs bg-blue-50/20">
          <div className="text-[11px] font-mono font-bold text-blue-800 uppercase">
            Submitted / Needs Review
          </div>
          <div className="text-2xl font-bold font-mono text-blue-900 mt-1 tabular-nums">
            {submitted}
          </div>
          <div className="text-[11px] text-blue-700 mt-1 font-mono">
            Requires TA sign-off
          </div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs bg-emerald-50/20">
          <div className="text-[11px] font-mono font-bold text-emerald-800 uppercase">
            Verified & Approved
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900 mt-1 tabular-nums">
            {approved}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-mono">
            Deployment ready
          </div>
        </div>
      </div>

      {/* Compliance Overview Guidance */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <h3 className="text-xs font-bold font-mono uppercase text-slate-900">
            Mandatory Compliance Policy for Manpower Dispatch
          </h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl font-sans">
          Under Philippine Labor regulations and agency standards, candidate applications cannot be transitioned to <span className="font-mono font-bold text-teal-800">DEPLOYED</span> status until all assigned mandatory compliance clearances (NBI Clearance, SSS Static Form, PhilHealth Member Data Record, Pag-IBIG MID, and Medical Certificate) are uploaded and marked <span className="font-mono font-bold text-emerald-700">APPROVED</span>.
        </p>
      </div>

      {/* Active Compliance Verification Queue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-mono uppercase">
              Operational 201 Clearance Verification Queue
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Active candidates undergoing pre-employment documentation
            </p>
          </div>
          <Link to="/ta/applications">
            <Button variant="outline" size="sm">
              View All Applications Pipeline
            </Button>
          </Link>
        </div>

        {applicationsQuery.isLoading ? (
          <LoadingState variant="table" rows={4} />
        ) : complianceApps.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
              title="No Pending Compliance Clearances"
              description="All active candidates currently have their clearances processed or are in earlier pipeline stages."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Candidate Application</th>
                  <th className="px-4 py-3 font-semibold">Target Job Requisition</th>
                  <th className="px-4 py-3 font-semibold">Current Pipeline Stage</th>
                  <th className="px-4 py-3 font-semibold">Submitted Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Verification Action</th>
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
                        <div className="text-[11px] text-slate-400">
                          App #{app.id} • {app.user?.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-sans">
                        <div className="font-semibold">{app.jobPosting?.title || "Requisition"}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {app.jobPosting?.location || "Philippines"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-amber-50 text-amber-900 border border-amber-300">
                          {app.status}
                        </span>
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
                            Review 201 Checklist →
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            />
          </div>
        )}
      </div>

      {/* Review Modal */}
      <Dialog
        open={Boolean(reviewReqId)}
        onClose={() => setReviewReqId(null)}
        title="Review Compliance Document"
        description="Verify candidate submission and set approval state"
      >
        <div className="space-y-4">
          <Select
            label="Verification Decision"
            value={reviewStatus}
            onChange={(e) => setReviewStatus(e.target.value as any)}
            options={[
              { value: "APPROVED", label: "APPROVE (Clearance Verified)" },
              { value: "REJECTED", label: "REJECT (Unclear / Invalid Document)" },
            ]}
          />
          <Textarea
            label="Reviewer Notes"
            placeholder="e.g. Clearance verified authentic with no derogatory records"
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
