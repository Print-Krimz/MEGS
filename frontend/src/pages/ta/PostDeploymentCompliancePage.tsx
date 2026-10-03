import React, { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { documentsApi } from "../../lib/api/documents.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  DocumentPreviewModal,
} from "../../components/common";
import { Button, Dialog, Select, Textarea, Badge } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import type { Application } from "../../lib/types";
import {
  FileCheck2,
  FileText,
  Loader2,
  Maximize2,
  Eye,
  ExternalLink,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { getManilaToday } from "../../lib/field-limits";
import {
  calculateDaysOnSite,
  calculateUrgencyStatus,
  getWorkerUrgencyCategory,
} from "../../lib/compliance-queue";

const RequirementDocumentPreview: React.FC<{
  documentId: number;
  documentLabel: string;
  onExpand: () => void;
}> = ({ documentId, documentLabel, onExpand }) => {
  const { data: preview, isLoading, isError } = useQuery({
    queryKey: ["document-preview", documentId],
    queryFn: () => documentsApi.getPreview(documentId),
    staleTime: 1000 * 60 * 4,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px]">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-sans">
          <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
          <span>Loading document preview...</span>
        </div>
      </div>
    );
  }

  if (isError || !preview) {
    return (
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
        <div className="flex items-center gap-2 text-slate-600 truncate min-w-0">
          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">{documentLabel}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExpand}
          leftIcon={<Maximize2 className="w-3.5 h-3.5" />}
        >
          Expand
        </Button>
      </div>
    );
  }

  const resolvedUrl = preview.url;
  const isImage =
    preview.mimeType?.startsWith("image/") ||
    (resolvedUrl
      ? /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(resolvedUrl) ||
        (!resolvedUrl.toLowerCase().includes(".pdf") && resolvedUrl.startsWith("http"))
      : false);

  if (isImage && resolvedUrl) {
    return (
      <div className="space-y-1.5">
        <div className="relative group rounded-lg border border-slate-200 overflow-hidden bg-slate-900/5 flex items-center justify-center p-2 min-h-[140px] max-h-48">
          <img
            src={resolvedUrl}
            alt={preview.originalName || documentLabel}
            className="max-h-44 w-auto object-contain rounded"
          />
          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onExpand}
              leftIcon={<Maximize2 className="w-3.5 h-3.5" />}
            >
              Expand preview
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 font-sans">
          <span className="truncate max-w-[220px]" title={preview.originalName}>
            {preview.originalName}
          </span>
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold cursor-pointer shrink-0"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Expand</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2 bg-white rounded border border-slate-200 text-teal-700 shrink-0">
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900 truncate" title={preview.originalName || documentLabel}>
            {preview.originalName || documentLabel}
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            {preview.mimeType} • {(preview.sizeBytes / 1024).toFixed(1)} KB
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onExpand}
        leftIcon={<Eye className="w-3.5 h-3.5" />}
      >
        Preview document
      </Button>
    </div>
  );
};

export interface PostDeploymentCompliancePageProps {
  hideHeader?: boolean;
}

export type UrgencyFilter = "ALL" | "READY_FOR_REVIEW" | "UPCOMING" | "OVERDUE" | "HEALTHY";

export const PostDeploymentCompliancePage: React.FC<PostDeploymentCompliancePageProps> = ({
  hideHeader = false,
}) => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Quick review modal state
  const [quickReviewApp, setQuickReviewApp] = useState<Application | null>(null);
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "REJECTED" | "TO_FOLLOW">("APPROVED");
  const [toFollowExpectedAt, setToFollowExpectedAt] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [previewDocState, setPreviewDocState] = useState<{
    open: boolean;
    documentId?: number | null;
    title?: string;
  }>({ open: false });

  const {
    data: applications = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["ta-compliance-queue", "POST_DEPLOYMENT"],
    queryFn: () => taApi.getComplianceQueue("POST_DEPLOYMENT"),
  });

  const metrics = useMemo(() => {
    let totalFollowUpDocs = 0;
    let readyForReviewCount = 0;
    let readyForReviewDocs = 0;
    let dueThisCutoffCount = 0;
    let overdueCount = 0;

    for (const app of applications) {
      const reqs = app.complianceRequirements || [];
      const pendingReqs = reqs.filter((r) => r.reviewStatus !== "APPROVED");
      totalFollowUpDocs += pendingReqs.length;

      const submittedReqs = reqs.filter((r) => r.reviewStatus === "SUBMITTED");
      if (submittedReqs.length > 0) {
        readyForReviewCount += 1;
      }
      readyForReviewDocs += submittedReqs.length;

      const hasUpcoming = pendingReqs.some((r) => {
        const urgency = calculateUrgencyStatus(r.toFollowExpectedAt);
        return urgency.category === "UPCOMING";
      });
      if (hasUpcoming) {
        dueThisCutoffCount += 1;
      }

      const hasOverdue = pendingReqs.some((r) => {
        const urgency = calculateUrgencyStatus(r.toFollowExpectedAt);
        return urgency.category === "OVERDUE";
      });
      if (hasOverdue) {
        overdueCount += 1;
      }
    }

    return {
      totalWorkersWithFollowUps: applications.length,
      totalFollowUpDocs,
      readyForReviewCount,
      readyForReviewDocs,
      dueThisCutoffCount,
      overdueCount,
    };
  }, [applications]);

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        reviewStatus: "APPROVED" | "REJECTED" | "TO_FOLLOW";
        reviewNotes?: string;
        toFollowExpectedAt?: string | null;
      };
    }) => taApi.reviewComplianceRequirement(id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta-compliance-queue"] });
      queryClient.invalidateQueries({ queryKey: ["ta"] });

      setQuickReviewApp((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          complianceRequirements: prev.complianceRequirements?.map((r) =>
            r.id === vars.id
              ? {
                  ...r,
                  reviewStatus: vars.data.reviewStatus,
                  reviewNotes: vars.data.reviewNotes ?? null,
                  toFollowExpectedAt: vars.data.toFollowExpectedAt ?? null,
                  reviewedAt: new Date().toISOString(),
                }
              : r
          ),
        };
      });

      const msg =
        vars.data.reviewStatus === "APPROVED"
          ? "Requirement approved."
          : vars.data.reviewStatus === "TO_FOLLOW"
          ? "Target completion date updated."
          : "Requirement rejected and marked for replacement.";
      notify.success("Review saved", msg);
    },
    onError: (err: any) => {
      notify.error("Review failed", err?.message || "Unable to save review decision.");
    },
  });

  const handleOpenQuickReview = (app: Application) => {
    setQuickReviewApp(app);
    const reqs = app.complianceRequirements || [];
    const defaultReq =
      reqs.find((r) => r.reviewStatus !== "APPROVED") ||
      reqs[0];
    setSelectedReqId(defaultReq ? defaultReq.id : null);
    setReviewStatus(
      defaultReq?.reviewStatus === "TO_FOLLOW"
        ? "TO_FOLLOW"
        : defaultReq?.reviewStatus === "REJECTED"
        ? "REJECTED"
        : "APPROVED"
    );
    setToFollowExpectedAt(
      defaultReq?.toFollowExpectedAt
        ? new Date(defaultReq.toFollowExpectedAt).toISOString().split("T")[0]
        : ""
    );
    setReviewNotes(defaultReq?.reviewNotes || "");
  };

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const urgencyCategory = getWorkerUrgencyCategory(app);

      let matchesUrgency = true;
      if (urgencyFilter === "READY_FOR_REVIEW") {
        matchesUrgency = (app.complianceRequirements || []).some(
          (r) => r.reviewStatus === "SUBMITTED"
        );
      } else if (urgencyFilter === "OVERDUE") {
        matchesUrgency = (app.complianceRequirements || []).some(
          (r) =>
            r.reviewStatus !== "APPROVED" &&
            calculateUrgencyStatus(r.toFollowExpectedAt).category === "OVERDUE"
        );
      } else if (urgencyFilter === "UPCOMING") {
        matchesUrgency = (app.complianceRequirements || []).some(
          (r) =>
            r.reviewStatus !== "APPROVED" &&
            calculateUrgencyStatus(r.toFollowExpectedAt).category === "UPCOMING"
        );
      } else if (urgencyFilter === "HEALTHY") {
        matchesUrgency = urgencyCategory === "HEALTHY";
      }

      const q = search.trim().toLowerCase();
      const profile = app.user?.applicantProfile;
      const fullName = profile
        ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
        : "";
      const email = app.user?.email || "";
      const jobTitle = app.jobPosting?.title || "";
      const clientName =
        app.jobPosting?.mrf?.client?.name ||
        app.deployments?.[0]?.client?.name ||
        "";

      const matchesSearch =
        !q ||
        fullName.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        jobTitle.toLowerCase().includes(q) ||
        clientName.toLowerCase().includes(q);

      return matchesUrgency && matchesSearch;
    });
  }, [applications, search, urgencyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const paginatedApplications = filteredApplications.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (key: string, val: string) => {
    if (key === "urgency") {
      setUrgencyFilter((val as UrgencyFilter) || "ALL");
      setPage(1);
    }
  };

  const handleReset = () => {
    setSearch("");
    setUrgencyFilter("ALL");
    setPage(1);
  };

  const isFilterActive = search.trim().length > 0 || urgencyFilter !== "ALL";

  if (isLoading) {
    return <LoadingState message="Loading post-deployment follow-up records..." />;
  }

  if (isError) {
    return (
      <ErrorState
        message="Failed to load post-deployment records."
        onRetry={() => refetch()}
      />
    );
  }

  if (applications.length === 0) {
    return (
      <div className="space-y-6">
        {!hideHeader && (
          <PageHeader
            title="Post-Deployment Follow-ups"
            description="Track pending and deferred compliance requirements for deployed workers."
          />
        )}
        <EmptyState
          icon={FileCheck2}
          title="No pending follow-up requirements"
          description="All deployed workers have verified compliance files."
        />
      </div>
    );
  }

  const selectedReq = quickReviewApp?.complianceRequirements?.find(
    (r) => r.id === selectedReqId
  );

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <PageHeader
          title="Post-Deployment Follow-ups"
          description="Track pending and deferred compliance requirements for deployed workers."
        />
      )}

      {/* 4 Anti-slop Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          type="button"
          aria-pressed={urgencyFilter === "ALL"}
          onClick={() => {
            setUrgencyFilter("ALL");
            setPage(1);
          }}
          className={`text-left rounded-lg border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
            urgencyFilter === "ALL"
              ? "border-slate-900 ring-2 ring-slate-900/20 bg-slate-50/60"
              : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/40"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            WORKERS WITH FOLLOW-UPS
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-slate-900">
            {metrics.totalWorkersWithFollowUps}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            {metrics.totalFollowUpDocs} requirements tracked
          </div>
        </button>

        <button
          type="button"
          aria-pressed={urgencyFilter === "READY_FOR_REVIEW"}
          onClick={() => {
            setUrgencyFilter("READY_FOR_REVIEW");
            setPage(1);
          }}
          className={`text-left rounded-lg border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
            urgencyFilter === "READY_FOR_REVIEW"
              ? "border-slate-900 ring-2 ring-slate-900/20 bg-slate-50/60"
              : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/40"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            READY FOR REVIEW
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-blue-700">
            {metrics.readyForReviewCount}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            {metrics.readyForReviewDocs} documents to verify
          </div>
        </button>

        <button
          type="button"
          aria-pressed={urgencyFilter === "UPCOMING"}
          onClick={() => {
            setUrgencyFilter("UPCOMING");
            setPage(1);
          }}
          className={`text-left rounded-lg border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
            urgencyFilter === "UPCOMING"
              ? "border-slate-900 ring-2 ring-slate-900/20 bg-slate-50/60"
              : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/40"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            DUE THIS CUT-OFF
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-amber-800">
            {metrics.dueThisCutoffCount}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            Within 7-day grace window
          </div>
        </button>

        <button
          type="button"
          aria-pressed={urgencyFilter === "OVERDUE"}
          onClick={() => {
            setUrgencyFilter("OVERDUE");
            setPage(1);
          }}
          className={`text-left rounded-lg border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
            urgencyFilter === "OVERDUE"
              ? "border-slate-900 ring-2 ring-slate-900/20 bg-slate-50/60"
              : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/40"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            OVERDUE COMPLIANCE
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-rose-700">
            {metrics.overdueCount}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            Exceeded target date
          </div>
        </button>
      </div>

      {/* Filters */}
      <SearchFilters
        searchPlaceholder="Search by candidate name, job title, or client..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={{ urgency: urgencyFilter }}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "urgency",
            label: "Urgency",
            options: [
              { value: "ALL", label: "All urgency levels" },
              { value: "READY_FOR_REVIEW", label: "Ready for review" },
              { value: "OVERDUE", label: "Overdue" },
              { value: "UPCOMING", label: "Upcoming (within 7 days)" },
              { value: "HEALTHY", label: "Healthy (> 7 days)" },
            ],
          },
        ]}
      />

      {/* Results View */}
      {filteredApplications.length === 0 ? (
        <EmptyState
          title="No matching follow-up records"
          description="No deployed workers match the search criteria or selected urgency filter."
          action={
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="bg-white border border-[#D9E2EC] rounded-lg shadow-xs overflow-hidden">
          {/* Inner Table Header Banner */}
          <div className="p-3.5 border-b border-[#D9E2EC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F7F9FC]">
            <div>
              <h3 className="text-sm font-semibold text-[#102A43] uppercase font-mono">
                POST-DEPLOYMENT FOLLOW-UP QUEUE
              </h3>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Showing {filteredApplications.length} active worker{filteredApplications.length === 1 ? "" : "s"} with pending requirements
              </p>
            </div>
            {isFilterActive ? (
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset filter
              </Button>
            ) : (
              <span className="text-xs font-mono text-slate-500">
                {applications.length} worker{applications.length === 1 ? "" : "s"} tracked
              </span>
            )}
          </div>
          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-slate-200">
            {paginatedApplications.map((app) => {
              const profile = app.user?.applicantProfile;
              const workerName = profile
                ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
                : app.user?.email || "Worker";
              const employeeNumber =
                app.user?.employee?.employeeNumber || app.hiredEmployee?.employeeNumber;
              const jobTitle = app.jobPosting?.title || "Job opening";
              const clientName =
                app.jobPosting?.mrf?.client?.name ||
                app.deployments?.[0]?.client?.name ||
                "Site Client";
              const deployment = app.deployments?.[0];
              const daysOnSite = calculateDaysOnSite(deployment?.contractStart);
              const followUpReqs = (app.complianceRequirements || []).filter(
                (r) => r.reviewStatus !== "APPROVED"
              );

              return (
                <article key={app.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-slate-950">{workerName}</h4>
                      <p className="text-xs text-slate-500">{app.user?.email}</p>
                    </div>
                    {employeeNumber && (
                      <Badge variant="neutral" size="sm">
                        {employeeNumber}
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-slate-700">
                    <span className="font-medium text-slate-900">{jobTitle}</span>
                    <span className="text-slate-500"> • {clientName}</span>
                  </div>

                  <div className="text-xs text-slate-600">
                    <span>Started {formatDate(deployment?.contractStart)}</span>
                    {daysOnSite !== null && (
                      <span className="text-slate-500 font-mono ml-2">
                        ({daysOnSite} {daysOnSite === 1 ? "day" : "days"} on site)
                      </span>
                    )}
                  </div>

                  {/* Requirements Badges */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-500 font-mono uppercase">
                      Follow-up Documents
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {followUpReqs.map((req) => (
                        <Badge key={req.id} variant="neutral" size="sm">
                          {req.documentLabel}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Target Date Urgency */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 font-mono uppercase">
                      Target Due Date & Urgency
                    </div>
                    <div className="flex flex-col gap-1 items-start">
                      {followUpReqs.length === 0 ? (
                        <Badge variant="neutral" size="sm">
                          No target date
                        </Badge>
                      ) : (
                        followUpReqs.map((req) => {
                          const urgency = calculateUrgencyStatus(req.toFollowExpectedAt);
                          return (
                            <Badge key={req.id} variant={urgency.variant} size="sm">
                              {urgency.label}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenQuickReview(app)}
                    >
                      Quick review
                    </Button>
                    <Link
                      to="/ta/applications/$applicationId"
                      params={{ applicationId: String(app.id) }}
                      className="text-xs text-teal-700 hover:text-teal-900 font-medium inline-flex items-center gap-1"
                    >
                      <span>View details</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop High-density Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Worker</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Site Assignment</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Deployment Info</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Follow-Up Documents</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Target Due Date & Urgency Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedApplications.map((app) => {
                  const profile = app.user?.applicantProfile;
                  const workerName = profile
                    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
                    : app.user?.email || "Worker";
                  const employeeNumber =
                    app.user?.employee?.employeeNumber || app.hiredEmployee?.employeeNumber;
                  const jobTitle = app.jobPosting?.title || "Job opening";
                  const clientName =
                    app.jobPosting?.mrf?.client?.name ||
                    app.deployments?.[0]?.client?.name ||
                    "N/A";
                  const deployment = app.deployments?.[0];
                  const daysOnSite = calculateDaysOnSite(deployment?.contractStart);
                  const followUpReqs = (app.complianceRequirements || []).filter(
                    (r) => r.reviewStatus !== "APPROVED"
                  );

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Worker */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 font-sans">{workerName}</span>
                          {employeeNumber && (
                            <Badge variant="neutral" size="sm">
                              {employeeNumber}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-sans">{app.user?.email}</div>
                      </td>

                      {/* Site Assignment */}
                      <td className="px-4 py-3 font-sans">
                        <div className="font-semibold text-slate-900">{jobTitle}</div>
                        <div className="text-xs text-slate-500">{clientName}</div>
                      </td>

                      {/* Deployment Info */}
                      <td className="px-4 py-3 font-sans">
                        <div className="text-slate-900 font-mono text-xs">
                          {formatDate(deployment?.contractStart)}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {daysOnSite !== null
                            ? `${daysOnSite} ${daysOnSite === 1 ? "day" : "days"} on site`
                            : "-"}
                        </div>
                      </td>

                      {/* Follow-Up Documents */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {followUpReqs.length === 0 ? (
                            <span className="text-slate-400 font-sans text-xs">None</span>
                          ) : (
                            followUpReqs.map((req) => (
                              <Badge key={req.id} variant="neutral" size="sm">
                                {req.documentLabel}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Target Due Date & Urgency Status */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {followUpReqs.length === 0 ? (
                            <Badge variant="neutral" size="sm">
                              No target date
                            </Badge>
                          ) : (
                            followUpReqs.map((req) => {
                              const urgency = calculateUrgencyStatus(req.toFollowExpectedAt);
                              return (
                                <Badge key={req.id} variant={urgency.variant} size="sm">
                                  {urgency.label}
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenQuickReview(app)}
                          >
                            Quick review
                          </Button>
                          <Link
                            to="/ta/applications/$applicationId"
                            params={{ applicationId: String(app.id) }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`View application for ${workerName}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredApplications.length > pageSize && (
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredApplications.length}
                pageSize={pageSize}
                onPageChange={setPage}
                itemLabel="workers"
              />
            </div>
          )}
        </div>
      )}

      {/* Quick Review Dialog */}
      {quickReviewApp && (
        <Dialog
          open={Boolean(quickReviewApp)}
          onClose={() => setQuickReviewApp(null)}
          title="Quick compliance review"
          description={`Review post-deployment documents for ${
            quickReviewApp.user?.applicantProfile
              ? `${quickReviewApp.user.applicantProfile.firstName || ""} ${quickReviewApp.user.applicantProfile.lastName || ""}`.trim()
              : quickReviewApp.user?.email || "Worker"
          } • ${quickReviewApp.jobPosting?.title || "Job opening"}`}
        >
          <div className="space-y-4">
            {/* Requirements List */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Follow-up Documents ({quickReviewApp.complianceRequirements?.length || 0})
              </label>
              {!quickReviewApp.complianceRequirements ||
              quickReviewApp.complianceRequirements.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No compliance requirements found for this worker.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                  {quickReviewApp.complianceRequirements.map((req) => {
                    const isSelected = req.id === selectedReqId;
                    const urgency = calculateUrgencyStatus(req.toFollowExpectedAt);
                    return (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() => {
                          setSelectedReqId(req.id);
                          setReviewStatus(
                            req.reviewStatus === "TO_FOLLOW"
                              ? "TO_FOLLOW"
                              : req.reviewStatus === "REJECTED"
                              ? "REJECTED"
                              : "APPROVED"
                          );
                          setToFollowExpectedAt(
                            req.toFollowExpectedAt
                              ? new Date(req.toFollowExpectedAt).toISOString().split("T")[0]
                              : ""
                          );
                          setReviewNotes(req.reviewNotes || "");
                        }}
                        className={`w-full p-2.5 text-left flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-teal-50/70 text-teal-950 font-medium"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isSelected ? "bg-teal-600" : "bg-transparent"
                            }`}
                          />
                          <span className="truncate">{req.documentLabel}</span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          <Badge variant={urgency.variant} size="sm">
                            {urgency.label}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedReq ? (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-800">
                  Reviewing: <span className="font-bold text-teal-900">{selectedReq.documentLabel}</span>
                </div>

                {selectedReq.documentId ? (
                  <RequirementDocumentPreview
                    documentId={selectedReq.documentId}
                    documentLabel={selectedReq.documentLabel}
                    onExpand={() =>
                      setPreviewDocState({
                        open: true,
                        documentId: selectedReq.documentId,
                        title: selectedReq.documentLabel,
                      })
                    }
                  />
                ) : (
                  <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center">
                    <p className="text-xs text-slate-500">
                      No document uploaded yet by worker
                    </p>
                  </div>
                )}

                <Select
                  label="Review decision"
                  value={reviewStatus}
                  onChange={(e) =>
                    setReviewStatus(e.target.value as "APPROVED" | "REJECTED" | "TO_FOLLOW")
                  }
                  options={[
                    { value: "APPROVED", label: "Approve: document verified" },
                    { value: "TO_FOLLOW", label: "To follow up: update target date" },
                    { value: "REJECTED", label: "Reject: document requires correction" },
                  ]}
                />

                {reviewStatus === "TO_FOLLOW" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Target completion date
                    </label>
                    <input
                      type="date"
                      value={toFollowExpectedAt}
                      onChange={(e) => setToFollowExpectedAt(e.target.value)}
                      min={getManilaToday()}
                      max="2100-12-31"
                      className="w-full text-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Keep this date updated until the worker submits final files.
                    </p>
                  </div>
                )}

                <Textarea
                  label="Review notes (optional)"
                  placeholder="Record verification notes or reasons for revision..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                />

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickReviewApp(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant={reviewStatus === "REJECTED" ? "danger" : "primary"}
                    size="sm"
                    loading={reviewMutation.isPending}
                    onClick={() => {
                      if (selectedReqId) {
                        reviewMutation.mutate({
                          id: selectedReqId,
                          data: {
                            reviewStatus,
                            reviewNotes: reviewNotes.trim() || undefined,
                            toFollowExpectedAt: toFollowExpectedAt ? toFollowExpectedAt : null,
                          },
                        });
                      }
                    }}
                  >
                    Save review
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setQuickReviewApp(null)}>
                  Close
                </Button>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Expanded Document Preview Modal */}
      {previewDocState.open && previewDocState.documentId && (
        <DocumentPreviewModal
          open={previewDocState.open}
          onClose={() => setPreviewDocState({ open: false })}
          documentId={previewDocState.documentId}
          title={previewDocState.title}
        />
      )}
    </div>
  );
};
