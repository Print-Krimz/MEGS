import React, { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { taApi } from "../../lib/api/ta.api";
import { PageHeader, LoadingState, ErrorState, EmptyState, type DataTableColumn, type DataTableSort } from "../../components/common";
import type { FilterConfig } from "../../components/common/SearchFilters";
import { Button } from "../../components/ui";
import {
  ComplianceQueue,
  ComplianceReviewDialog,
  openRequirementsOf,
  useComplianceReviewSession,
  type ComplianceTile,
} from "../../components/ta/compliance";
import type { RequirementReviewValues } from "../../components/ta/RequirementReviewDialog";
import { formatDate } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
import type { Application } from "../../lib/types";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { plural } from "../../lib/plural";
import { calculateDaysOnSite } from "../../lib/compliance-queue";

type StatusFilter = "ALL" | "WAITING_CANDIDATE" | "WAITING_REVIEW" | "APPROVED" | "TO_FOLLOW";

/** One name per filter, used by the tile and by the select so the same filter never reads two ways. */
const STATUS_LABELS = {
  WAITING_CANDIDATE: "Awaiting submission",
  WAITING_REVIEW: "Ready for review",
  APPROVED: "Cleared",
  TO_FOLLOW: "To follow up",
} as const;

const PAGE_SIZE = 8;

interface ComplianceCounts {
  submittedCount: number;
  pendingCount: number;
  approvedCount: number;
  toFollowCount: number;
  totalCount: number;
}

const getComplianceCounts = (app: Application): ComplianceCounts => {
  const reqs = app.complianceRequirements || [];
  const submittedCount = reqs.filter((r) => r.reviewStatus === "SUBMITTED").length;
  const pendingCount = reqs.filter((r) => r.reviewStatus === "PENDING").length;
  const approvedCount = reqs.filter((r) => r.reviewStatus === "APPROVED").length;
  const toFollowCount = reqs.filter((r) => r.reviewStatus === "TO_FOLLOW").length;
  return { submittedCount, pendingCount, approvedCount, toFollowCount, totalCount: reqs.length };
};

const isCleared = (c: ComplianceCounts) => c.totalCount > 0 && c.approvedCount + c.toFollowCount === c.totalCount;

const candidateNameOf = (app: Application): string => {
  const profile = app.user?.applicantProfile;
  return profile ? `${profile.firstName} ${profile.lastName}` : app.user?.email || "Candidate";
};

/** How long the application has been in the queue, counted from its submitted date. */
const waitingLabel = (app: Application): string => {
  const days = calculateDaysOnSite(app.createdAt);
  if (days === null) return "";
  return days === 0 ? "Waiting since today" : `Waiting ${plural(days, "day")}`;
};

/** One plain sentence for where a candidate's documents stand. Amber only when the TA has work to do. */
const progressOf = (app: Application): { text: string; className: string } => {
  const c = getComplianceCounts(app);
  if (c.submittedCount > 0) {
    return { text: `${c.submittedCount} awaiting review`, className: "font-medium text-amber-800" };
  }
  if (c.pendingCount > 0) {
    return {
      text: `${c.pendingCount} not submitted${c.toFollowCount > 0 ? ` · ${c.toFollowCount} to follow` : ""}`,
      className: "text-slate-700",
    };
  }
  if (isCleared(c)) {
    return {
      text: c.toFollowCount > 0 ? `Cleared · ${c.toFollowCount} to follow` : `All ${c.approvedCount} approved`,
      className: "text-emerald-800",
    };
  }
  if (c.toFollowCount > 0) return { text: `${c.toFollowCount} to follow`, className: "text-amber-800" };
  return { text: "No requirements", className: "text-slate-600" };
};

export const CompliancePage: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [jobTitleFilter, setJobTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  // Oldest waiting first: the review queue starts with whoever has waited longest.
  const [sort, setSort] = useState<DataTableSort>({ key: "submitted", direction: "asc" });
  const [queuePage, setQueuePage] = useState(1);

  const review = useComplianceReviewSession("pre");

  const applicationsQuery = useQuery({
    queryKey: ["ta", "applications", "compliance-queue"],
    queryFn: () => taApi.listApplications({ status: ApplicationStatus.COMPLIANCE, limit: 100 }),
  });

  const complianceApps = useMemo(() => {
    const data = applicationsQuery.data;
    const raw = Array.isArray(data) ? data : data?.data || [];
    return raw.filter((a) => a.status === ApplicationStatus.COMPLIANCE);
  }, [applicationsQuery.data]);

  const metrics = useMemo(() => {
    let waitingReview = 0;
    let waitingCandidate = 0;
    let fullyApproved = 0;
    let totalDocs = 0;
    let pendingDocs = 0;
    let submittedDocs = 0;

    for (const app of complianceApps) {
      const c = getComplianceCounts(app);
      if (c.submittedCount > 0) waitingReview++;
      if (c.pendingCount > 0) waitingCandidate++;
      if (isCleared(c)) fullyApproved++;
      pendingDocs += c.pendingCount;
      submittedDocs += c.submittedCount;
      totalDocs += c.totalCount;
    }
    return { total: complianceApps.length, waitingReview, waitingCandidate, fullyApproved, totalDocs, pendingDocs, submittedDocs };
  }, [complianceApps]);

  const jobTitleOptions = useMemo(
    () =>
      Array.from(
        new Set(
          complianceApps
            .map((app) => app.jobPosting?.title)
            .filter((title): title is string => Boolean(title && title.trim()))
        )
      )
        .sort((a, b) => a.localeCompare(b))
        .map((title) => ({ value: title, label: title })),
    [complianceApps]
  );

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return complianceApps.filter((app) => {
      const c = getComplianceCounts(app);

      let matchesStatus = true;
      if (statusFilter === "WAITING_REVIEW") matchesStatus = c.submittedCount > 0;
      else if (statusFilter === "WAITING_CANDIDATE") matchesStatus = c.pendingCount > 0;
      else if (statusFilter === "APPROVED") matchesStatus = isCleared(c);
      else if (statusFilter === "TO_FOLLOW") matchesStatus = c.toFollowCount > 0;

      const jobTitle = app.jobPosting?.title || "";
      const matchesSearch =
        !q ||
        candidateNameOf(app).toLowerCase().includes(q) ||
        (app.user?.email || "").toLowerCase().includes(q) ||
        jobTitle.toLowerCase().includes(q);
      const matchesJobTitle = !jobTitleFilter || jobTitle === jobTitleFilter;

      return matchesStatus && matchesSearch && matchesJobTitle;
    });
  }, [complianceApps, statusFilter, search, jobTitleFilter]);

  const sortedApps = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filteredApps].sort((a, b) => {
      const comparison =
        sort.key === "candidate"
          ? candidateNameOf(a).localeCompare(candidateNameOf(b))
          : (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0);
      return comparison * direction;
    });
  }, [filteredApps, sort]);

  const pagedApps = sortedApps.slice((queuePage - 1) * PAGE_SIZE, queuePage * PAGE_SIZE);

  const handleReset = () => {
    setSearch("");
    setJobTitleFilter("");
    setStatusFilter("ALL");
    setQueuePage(1);
  };

  const reviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RequirementReviewValues }) => taApi.reviewComplianceRequirement(id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics", "compliance"] });
      review.applySaved(vars.id, vars.data);

      notify.success(
        "Review saved",
        vars.data.reviewStatus === "APPROVED"
          ? "The requirement was approved."
          : vars.data.reviewStatus === "TO_FOLLOW"
          ? "The requirement was tagged to follow up."
          : "The requirement was rejected and needs correction."
      );
    },
    onError: (err: unknown) => {
      notify.error("Review failed", err);
    },
  });

  const reviewButton = (app: Application, className?: string) =>
    openRequirementsOf(app).length > 0 ? (
      <Button variant="outline" size="sm" className={className} onClick={() => review.open(app)}>
        Review documents
      </Button>
    ) : null;

  const tiles: ComplianceTile[] = [
    { id: "ALL", label: "In requirements", value: metrics.total, hint: `${plural(metrics.totalDocs, "document")} tracked` },
    {
      id: "WAITING_CANDIDATE",
      label: STATUS_LABELS.WAITING_CANDIDATE,
      value: metrics.waitingCandidate,
      hint: `${plural(metrics.pendingDocs, "document")} not submitted`,
      tone: "warning",
    },
    {
      id: "WAITING_REVIEW",
      label: STATUS_LABELS.WAITING_REVIEW,
      value: metrics.waitingReview,
      hint: `${plural(metrics.submittedDocs, "document")} to verify`,
    },
    { id: "APPROVED", label: STATUS_LABELS.APPROVED, value: metrics.fullyApproved, hint: "Ready for contract signing" },
  ];

  const filters: FilterConfig[] = [
    { key: "jobTitle", label: "Job opening", placeholder: "All job openings", options: jobTitleOptions },
    {
      key: "requirementStatus",
      label: "Requirement status",
      placeholder: "All statuses",
      options: [
        { value: "WAITING_REVIEW", label: STATUS_LABELS.WAITING_REVIEW },
        { value: "WAITING_CANDIDATE", label: STATUS_LABELS.WAITING_CANDIDATE },
        { value: "APPROVED", label: STATUS_LABELS.APPROVED },
        { value: "TO_FOLLOW", label: STATUS_LABELS.TO_FOLLOW },
      ],
    },
  ];

  const columns: DataTableColumn<Application>[] = [
    {
      key: "candidate",
      header: "Candidate",
      sortable: true,
      cell: (app) => (
        <div>
          <Link
            to="/ta/applications/$applicationId"
            params={{ applicationId: String(app.id) }}
            className="focus-ring font-medium text-navy underline-offset-2 hover:underline"
          >
            {candidateNameOf(app)}
          </Link>
          <div className="text-xs text-slate-600">{app.user?.email}</div>
        </div>
      ),
    },
    {
      key: "job",
      header: "Job opening",
      cell: (app) => (
        <div>
          <div className="text-slate-900">{app.jobPosting?.title || "Job opening"}</div>
          <div className="text-xs text-slate-600">{app.jobPosting?.location || "Philippines"}</div>
        </div>
      ),
    },
    {
      key: "progress",
      header: "Documents",
      cell: (app) => {
        const progress = progressOf(app);
        return <span className={progress.className}>{progress.text}</span>;
      },
    },
    {
      key: "submitted",
      header: "Waiting",
      sortable: true,
      cell: (app) => (
        <div>
          <div className="text-slate-900">{waitingLabel(app)}</div>
          <div className="text-xs text-slate-600">Since {formatDate(app.createdAt)}</div>
        </div>
      ),
    },
    { key: "actions", header: "Action", align: "right", className: "whitespace-nowrap", cell: (app) => reviewButton(app) },
  ];

  const renderCard = (app: Application) => {
    const progress = progressOf(app);
    return (
      <article className="space-y-2 p-4">
        <Link
          to="/ta/applications/$applicationId"
          params={{ applicationId: String(app.id) }}
          className="focus-ring inline-flex min-h-11 items-center font-semibold text-navy underline-offset-2 hover:underline"
        >
          {candidateNameOf(app)}
        </Link>
        <p className="break-words text-sm text-slate-700">{app.jobPosting?.title || "Job opening"}</p>
        <p className={`text-sm ${progress.className}`}>{progress.text}</p>
        <p className="text-sm text-slate-600">
          {waitingLabel(app)} · since {formatDate(app.createdAt)}
        </p>
        {reviewButton(app, "w-full")}
      </article>
    );
  };

  const header = !hideHeader && (
    <PageHeader
      title={TA_COPY.pageTitles.requirements}
      description={TA_COPY.workforce.requirementsDescription}
      breadcrumbs={[{ label: TA_COPY.navigation.overview, href: "/ta" }, { label: TA_COPY.navigation.requirements }]}
      flush
    />
  );

  if (applicationsQuery.isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingState variant="table" rows={6} />
      </div>
    );
  }

  if (applicationsQuery.isError) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState error={applicationsQuery.error} onRetry={() => applicationsQuery.refetch()} subject="the requirements queue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {complianceApps.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          title="No candidates in the requirements stage"
          description="Candidates appear here after they pass the final interview."
        />
      ) : (
        <ComplianceQueue
          caption="Candidates in the requirements stage"
          tiles={tiles}
          selectedTile={statusFilter === "TO_FOLLOW" ? "" : statusFilter}
          onTileChange={(id) => {
            setStatusFilter(id as StatusFilter);
            setQueuePage(1);
          }}
          searchLabel="Search candidates"
          searchPlaceholder="Search candidate, email, or job opening"
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setQueuePage(1);
          }}
          filters={filters}
          filterValues={{ jobTitle: jobTitleFilter, requirementStatus: statusFilter !== "ALL" ? statusFilter : "" }}
          onFilterChange={(key, value) => {
            if (key === "jobTitle") setJobTitleFilter(value);
            else if (key === "requirementStatus") setStatusFilter((value as StatusFilter) || "ALL");
            setQueuePage(1);
          }}
          onReset={handleReset}
          columns={columns}
          rows={pagedApps}
          renderCard={renderCard}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setQueuePage(1);
          }}
          isFetching={applicationsQuery.isFetching}
          empty={
            <EmptyState
              bare
              title="No matching candidates"
              description="No candidates match your search or filters."
              action={
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reset filters
                </Button>
              }
            />
          }
          page={queuePage}
          pageSize={PAGE_SIZE}
          totalItems={sortedApps.length}
          onPageChange={setQueuePage}
          itemLabel="candidates"
        />
      )}

      <ComplianceReviewDialog
        session={review}
        mode="pre"
        personName={candidateNameOf}
        isSubmitting={reviewMutation.isPending}
        onSubmit={(values, requirement) => reviewMutation.mutate({ id: requirement.id, data: values })}
      />
    </div>
  );
};
