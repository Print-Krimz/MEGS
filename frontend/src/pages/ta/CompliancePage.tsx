import React, { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
import type { Application, ComplianceRequirement } from "../../lib/types";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";

type StatusFilter = "ALL" | "WAITING_CANDIDATE" | "WAITING_REVIEW" | "APPROVED";
type SortField = "candidate" | "submitted";
type SortDirection = "asc" | "desc";

interface ComplianceCounts {
  submittedCount: number;
  pendingCount: number;
  approvedCount: number;
  totalCount: number;
}

const getComplianceCounts = (app: Application): ComplianceCounts => {
  const reqs = app.complianceRequirements || [];
  const submittedCount = reqs.filter((r) => r.reviewStatus === "SUBMITTED").length;
  const pendingCount = reqs.filter((r) => r.reviewStatus === "PENDING").length;
  const approvedCount = reqs.filter((r) => r.reviewStatus === "APPROVED").length;
  const totalCount = reqs.length;
  return { submittedCount, pendingCount, approvedCount, totalCount };
};

export const CompliancePage: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [jobTitleFilter, setJobTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortField, setSortField] = useState<SortField>("submitted");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [queuePage, setQueuePage] = useState(1);
  const queuePageSize = 8;

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Quick review modal state
  const [quickReviewCandidate, setQuickReviewCandidate] = useState<Application | null>(null);
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewNotes, setReviewNotes] = useState("");

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

  const complianceApps = useMemo(() => {
    return rawApps.filter((a) => a.status === ApplicationStatus.COMPLIANCE);
  }, [rawApps]);

  const jobTitleOptions = useMemo(() => {
    const titles = Array.from(
      new Set(
        complianceApps
          .map((app) => app.jobPosting?.title)
          .filter((title): title is string => Boolean(title && title.trim()))
      )
    ).sort((a, b) => a.localeCompare(b));

    return titles.map((title) => ({
      value: title,
      label: title,
    }));
  }, [complianceApps]);

  const filteredApps = useMemo(() => {
    return complianceApps.filter((app) => {
      const { submittedCount, pendingCount, approvedCount, totalCount } = getComplianceCounts(app);

      let matchesStatus = true;
      if (statusFilter === "WAITING_REVIEW") {
        matchesStatus = submittedCount > 0;
      } else if (statusFilter === "WAITING_CANDIDATE") {
        matchesStatus = pendingCount > 0;
      } else if (statusFilter === "APPROVED") {
        matchesStatus = totalCount > 0 && approvedCount === totalCount;
      }

      const q = search.trim().toLowerCase();
      const profile = app.user?.applicantProfile;
      const fullName = profile ? `${profile.firstName} ${profile.lastName}` : "";
      const email = app.user?.email || "";
      const jobTitle = app.jobPosting?.title || "";

      const matchesSearch =
        !q ||
        fullName.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        jobTitle.toLowerCase().includes(q);

      const matchesJobTitle = !jobTitleFilter || jobTitle === jobTitleFilter;

      return matchesStatus && matchesSearch && matchesJobTitle;
    });
  }, [complianceApps, statusFilter, search, jobTitleFilter]);

  const sortedApps = useMemo(() => {
    return [...filteredApps].sort((a, b) => {
      let comparison = 0;
      if (sortField === "candidate") {
        const nameA = a.user?.applicantProfile
          ? `${a.user.applicantProfile.firstName} ${a.user.applicantProfile.lastName}`
          : a.user?.email || "";
        const nameB = b.user?.applicantProfile
          ? `${b.user.applicantProfile.firstName} ${b.user.applicantProfile.lastName}`
          : b.user?.email || "";
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === "submitted") {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        comparison = timeA - timeB;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredApps, sortField, sortDirection]);

  const totalQueuePages = Math.max(1, Math.ceil(sortedApps.length / queuePageSize));
  const paginatedApps = sortedApps.slice(
    (queuePage - 1) * queuePageSize,
    queuePage * queuePageSize
  );

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setQueuePage(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === "jobTitle") {
      setJobTitleFilter(value);
    } else if (key === "requirementStatus") {
      setStatusFilter((value as StatusFilter) || "ALL");
    }
    setQueuePage(1);
  };

  const handleReset = () => {
    setSearch("");
    setJobTitleFilter("");
    setStatusFilter("ALL");
    setQueuePage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setQueuePage(1);
  };

  const handleOpenQuickReview = (app: Application) => {
    setQuickReviewCandidate(app);
    const reqs = app.complianceRequirements || [];
    const defaultReq =
      reqs.find((r) => r.reviewStatus === "SUBMITTED") ||
      reqs.find((r) => r.reviewStatus === "PENDING") ||
      reqs[0];
    setSelectedReqId(defaultReq ? defaultReq.id : null);
    setReviewStatus(defaultReq?.reviewStatus === "REJECTED" ? "REJECTED" : "APPROVED");
    setReviewNotes(defaultReq?.reviewNotes || "");
  };

  const reviewComplianceMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { reviewStatus: "APPROVED" | "REJECTED"; reviewNotes?: string };
    }) => taApi.reviewComplianceRequirement(id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics", "compliance"] });

      setQuickReviewCandidate((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          complianceRequirements: prev.complianceRequirements?.map((r) =>
            r.id === vars.id
              ? {
                  ...r,
                  reviewStatus: vars.data.reviewStatus,
                  reviewNotes: vars.data.reviewNotes ?? null,
                  reviewedAt: new Date().toISOString(),
                }
              : r
          ),
        };
      });

      const msg =
        vars.data.reviewStatus === "APPROVED"
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

  const getHeaderContent = () => {
    switch (statusFilter) {
      case "WAITING_REVIEW":
        return {
          title: "Requirements waiting for review",
          description: "Candidates with documents that need checking",
        };
      case "WAITING_CANDIDATE":
        return {
          title: "Waiting for candidate submission",
          description: "Candidates with pending requirements",
        };
      case "APPROVED":
        return {
          title: "Approved candidates",
          description: "Candidates ready for deployment",
        };
      default:
        return {
          title: "Pre-employment compliance queue",
          description: "Active candidates in pre-employment verification",
        };
    }
  };

  const headerContent = getHeaderContent();

  const renderSortHeader = (field: SortField, label: string) => {
    const isActive = sortField === field;
    return (
      <th scope="col" className="px-4 py-3 font-semibold select-none">
        <button
          type="button"
          onClick={() => handleSort(field)}
          className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 rounded"
          aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
        >
          <span>{label}</span>
          {isActive ? (
            sortDirection === "asc" ? (
              <ArrowUp className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
          )}
        </button>
      </th>
    );
  };

  const renderComplianceProgressBadge = (app: Application) => {
    const { submittedCount, pendingCount, approvedCount, totalCount } = getComplianceCounts(app);

    if (submittedCount > 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          {submittedCount} awaiting review
        </span>
      );
    }
    if (pendingCount > 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {pendingCount} pending submission
        </span>
      );
    }
    if (totalCount > 0 && approvedCount === totalCount) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          All {approvedCount} approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">
        No requirements
      </span>
    );
  };

  const renderReqStatusBadge = (status: ComplianceRequirement["reviewStatus"]) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            Rejected
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            Submitted
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Pending
          </span>
        );
    }
  };

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

  const selectedReq = quickReviewCandidate?.complianceRequirements?.find(
    (r) => r.id === selectedReqId
  );

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
            className="text-slate-400 hover:text-slate-600 font-bold ml-4 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Compliance Overview Metrics (Interactive Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          type="button"
          aria-pressed={statusFilter === "ALL"}
          onClick={() => {
            setStatusFilter("ALL");
            setQueuePage(1);
          }}
          className={`text-left rounded-xl border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
            statusFilter === "ALL"
              ? "border-slate-800 ring-2 ring-slate-800/20 bg-slate-50/60"
              : "border-slate-200 hover:border-slate-300 bg-white"
          }`}
        >
          <div className="text-xs font-semibold text-slate-600">
            Requirements tracked
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Across active candidates
          </div>
        </button>

        <button
          type="button"
          aria-pressed={statusFilter === "WAITING_CANDIDATE"}
          onClick={() => {
            setStatusFilter("WAITING_CANDIDATE");
            setQueuePage(1);
          }}
          className={`text-left rounded-xl border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            statusFilter === "WAITING_CANDIDATE"
              ? "border-amber-600 ring-2 ring-amber-600/20 bg-amber-50/50"
              : "border-amber-200 hover:border-amber-300 bg-amber-50/20"
          }`}
        >
          <div className="text-xs font-semibold text-amber-800">
            Waiting for candidate
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900 mt-1 tabular-nums">
            {pending}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 font-mono">
            Candidate still needs to submit
          </div>
        </button>

        <button
          type="button"
          aria-pressed={statusFilter === "WAITING_REVIEW"}
          onClick={() => {
            setStatusFilter("WAITING_REVIEW");
            setQueuePage(1);
          }}
          className={`text-left rounded-xl border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            statusFilter === "WAITING_REVIEW"
              ? "border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/50"
              : "border-blue-200 hover:border-blue-300 bg-blue-50/20"
          }`}
        >
          <div className="text-xs font-semibold text-blue-800">
            Waiting for review
          </div>
          <div className="text-2xl font-bold font-mono text-blue-900 mt-1 tabular-nums">
            {submitted}
          </div>
          <div className="text-[11px] text-blue-700 mt-1 font-mono">
            TA review needed
          </div>
        </button>

        <button
          type="button"
          aria-pressed={statusFilter === "APPROVED"}
          onClick={() => {
            setStatusFilter("APPROVED");
            setQueuePage(1);
          }}
          className={`text-left rounded-xl border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            statusFilter === "APPROVED"
              ? "border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/50"
              : "border-emerald-200 hover:border-emerald-300 bg-emerald-50/20"
          }`}
        >
          <div className="text-xs font-semibold text-emerald-800">
            Approved
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900 mt-1 tabular-nums">
            {approved}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-mono">
            Ready for deployment
          </div>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <SearchFilters
        searchPlaceholder="Search candidate, email, or job opening..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={{
          jobTitle: jobTitleFilter,
          requirementStatus: statusFilter !== "ALL" ? statusFilter : "",
        }}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "jobTitle",
            label: "Job Opening",
            placeholder: "All job openings",
            options: jobTitleOptions,
          },
          {
            key: "requirementStatus",
            label: "Requirement Status",
            placeholder: "All requirement statuses",
            options: [
              { value: "WAITING_REVIEW", label: "Waiting for review" },
              { value: "WAITING_CANDIDATE", label: "Waiting for candidate" },
              { value: "APPROVED", label: "Approved" },
            ],
          },
        ]}
      />

      {/* Active Compliance Verification Queue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-mono uppercase">
              {headerContent.title}
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              {headerContent.description}
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
        ) : filteredApps.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No matching candidates"
              description="No candidates match your current search, job opening, or status filter criteria."
              action={
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-slate-200">
              {paginatedApps.map((app) => {
                const profile = app.user?.applicantProfile;
                const candidateName = profile
                  ? `${profile.firstName} ${profile.lastName}`
                  : app.user?.email || "Candidate";

                return (
                  <article key={app.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-slate-950 break-words">{candidateName}</h4>
                        <p className="mt-0.5 text-sm text-slate-600 break-words">{app.jobPosting?.title || "Job opening"}</p>
                      </div>
                      {renderComplianceProgressBadge(app)}
                    </div>
                    <p className="text-sm text-slate-600">Submitted {formatDate(app.createdAt)}</p>
                    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
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
                        className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                        aria-label={`View application for ${candidateName}`}
                      >
                        View application
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    {renderSortHeader("candidate", "Candidate")}
                    <th scope="col" className="px-4 py-3 font-semibold">Job opening</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Compliance progress</th>
                    {renderSortHeader("submitted", "Submitted")}
                    <th scope="col" className="px-4 py-3 font-semibold text-right">Action</th>
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
                          {renderComplianceProgressBadge(app)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {formatDate(app.createdAt)}
                        </td>
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
                                aria-label={`View application for ${candidateName}`}
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
          </>
        )}

        {/* Queue Pagination */}
        {sortedApps.length > queuePageSize && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Pagination
              currentPage={queuePage}
              totalPages={totalQueuePages}
              totalItems={sortedApps.length}
              pageSize={queuePageSize}
              onPageChange={setQueuePage}
              itemLabel="candidates"
            />
          </div>
        )}
      </div>

      {/* Quick Review Dialog */}
      {quickReviewCandidate && (
        <Dialog
          open={Boolean(quickReviewCandidate)}
          onClose={() => setQuickReviewCandidate(null)}
          title="Quick compliance review"
          description={`Review documents for ${
            quickReviewCandidate.user?.applicantProfile
              ? `${quickReviewCandidate.user.applicantProfile.firstName} ${quickReviewCandidate.user.applicantProfile.lastName}`
              : quickReviewCandidate.user?.email || "Candidate"
          } • ${quickReviewCandidate.jobPosting?.title || "Job opening"}`}
        >
          <div className="space-y-4">
            {/* Requirements List */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Required Documents ({quickReviewCandidate.complianceRequirements?.length || 0})
              </label>
              {!quickReviewCandidate.complianceRequirements ||
              quickReviewCandidate.complianceRequirements.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No requirements configured for this application.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                  {quickReviewCandidate.complianceRequirements.map((req) => {
                    const isSelected = req.id === selectedReqId;
                    return (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() => {
                          setSelectedReqId(req.id);
                          setReviewStatus(req.reviewStatus === "REJECTED" ? "REJECTED" : "APPROVED");
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
                        <div className="shrink-0">
                          {renderReqStatusBadge(req.reviewStatus)}
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

                <Select
                  label="Review decision"
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as "APPROVED" | "REJECTED")}
                  options={[
                    { value: "APPROVED", label: "Approve — document is valid" },
                    { value: "REJECTED", label: "Reject — document needs correction" },
                  ]}
                />

                <Textarea
                  label="Review notes (optional)"
                  placeholder="Explain what was verified or what needs correction..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                />

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickReviewCandidate(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant={reviewStatus === "APPROVED" ? "primary" : "danger"}
                    size="sm"
                    loading={reviewComplianceMutation.isPending}
                    onClick={() => {
                      if (selectedReqId) {
                        reviewComplianceMutation.mutate({
                          id: selectedReqId,
                          data: {
                            reviewStatus,
                            reviewNotes: reviewNotes.trim() || undefined,
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
                <Button variant="outline" size="sm" onClick={() => setQuickReviewCandidate(null)}>
                  Close
                </Button>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
};
