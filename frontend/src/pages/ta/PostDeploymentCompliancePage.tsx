import React, { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileCheck2 } from "lucide-react";
import { taApi } from "../../lib/api/ta.api";
import { PageHeader, LoadingState, ErrorState, EmptyState, type DataTableColumn } from "../../components/common";
import type { FilterConfig } from "../../components/common/SearchFilters";
import { Button } from "../../components/ui";
import {
  ComplianceQueue,
  ComplianceReviewDialog,
  followUpDocumentUrgency,
  openRequirementsOf,
  summarizeFollowUpUrgency,
  useComplianceReviewSession,
  type ComplianceTile,
  type FollowUpUrgency,
} from "../../components/ta/compliance";
import type { RequirementReviewValues } from "../../components/ta/RequirementReviewDialog";
import { formatDate } from "../../lib/utils";
import type { Application } from "../../lib/types";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { plural } from "../../lib/plural";
import { calculateUrgencyStatus, getFollowUpTargetDate, getWorkerUrgencyCategory } from "../../lib/compliance-queue";

export interface PostDeploymentCompliancePageProps {
  hideHeader?: boolean;
}

export type UrgencyFilter = "ALL" | "READY_FOR_REVIEW" | "UPCOMING" | "OVERDUE" | "HEALTHY";

/** One name per filter, used by the tile and by the select so the same filter never reads two ways. */
const URGENCY_LABELS = {
  READY_FOR_REVIEW: "Ready for review",
  UPCOMING: "Due within 7 days",
  OVERDUE: "Overdue",
  HEALTHY: "Due later",
} as const;

const PAGE_SIZE = 10;
const VISIBLE_DOCUMENTS = 2;

const workerNameOf = (app: Application): string => {
  const profile = app.user?.applicantProfile;
  const name = profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : "";
  return name || app.user?.email || "Worker";
};

const clientNameOf = (app: Application): string =>
  app.jobPosting?.mrf?.client?.name || app.deployments?.[0]?.client?.name || "Client not recorded";

const urgencyClass = (tone: FollowUpUrgency["tone"]): string =>
  tone === "overdue"
    ? "font-medium text-rose-700"
    : tone === "upcoming"
    ? "font-medium text-amber-800"
    : "text-slate-700";

/** The single urgency line: red text and an icon for overdue, plain amber or slate otherwise. */
const UrgencyLine: React.FC<{ urgency: FollowUpUrgency }> = ({ urgency }) => (
  <div>
    <div className={`inline-flex items-start gap-1.5 text-sm ${urgencyClass(urgency.tone)}`}>
      {urgency.tone === "overdue" && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>{urgency.text}</span>
    </div>
    {urgency.nextDue && <div className="text-xs text-slate-600">Next due {urgency.nextDue}</div>}
  </div>
);

/** First two document names, then "+n more". The full list is in the review dialog. */
const DocumentNames: React.FC<{ app: Application }> = ({ app }) => {
  const open = openRequirementsOf(app);
  if (open.length === 0) return <span className="text-slate-600">None</span>;
  const shown = open.slice(0, VISIBLE_DOCUMENTS).map((r) => r.documentLabel);
  const extra = open.length - shown.length;
  const submitted = open.filter((r) => r.reviewStatus === "SUBMITTED").length;
  return (
    <div>
      <div className="text-slate-900">
        {shown.join(", ")}
        {extra > 0 && <span className="whitespace-nowrap text-slate-600"> +{extra} more</span>}
      </div>
      {submitted > 0 && <div className="text-xs font-medium text-amber-800">{submitted} awaiting review</div>}
    </div>
  );
};

/** Where the worker is posted, with the client start date when there is a deployment. */
const SiteCell: React.FC<{ app: Application }> = ({ app }) => {
  const deployment = app.deployments?.[0];
  return (
    <div>
      <div className="text-slate-900">{app.jobPosting?.title || "Job opening"}</div>
      <div className="text-xs text-slate-600">{clientNameOf(app)}</div>
      {deployment?.contractStart && <div className="text-xs text-slate-600">Since {formatDate(deployment.contractStart)}</div>}
    </div>
  );
};

export const PostDeploymentCompliancePage: React.FC<PostDeploymentCompliancePageProps> = ({ hideHeader = false }) => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("ALL");
  const [page, setPage] = useState(1);

  const review = useComplianceReviewSession("post");

  const {
    data: applications = [],
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["ta-compliance-queue", "POST_DEPLOYMENT"],
    queryFn: () => taApi.getComplianceQueue("POST_DEPLOYMENT"),
  });

  const metrics = useMemo(() => {
    let totalFollowUpDocs = 0;
    let readyForReviewCount = 0;
    let readyForReviewDocs = 0;
    let dueSoonCount = 0;
    let overdueCount = 0;

    for (const app of applications) {
      const reqs = app.complianceRequirements || [];
      const pending = reqs.filter((r) => r.reviewStatus !== "APPROVED");
      totalFollowUpDocs += pending.length;

      const submitted = reqs.filter((r) => r.reviewStatus === "SUBMITTED");
      if (submitted.length > 0) readyForReviewCount += 1;
      readyForReviewDocs += submitted.length;

      const categories = pending.map((r) => calculateUrgencyStatus(getFollowUpTargetDate(r)).category);
      if (categories.includes("UPCOMING")) dueSoonCount += 1;
      if (categories.includes("OVERDUE")) overdueCount += 1;
    }

    return { totalFollowUpDocs, readyForReviewCount, readyForReviewDocs, dueSoonCount, overdueCount };
  }, [applications]);

  const reviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RequirementReviewValues }) => taApi.reviewComplianceRequirement(id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta-compliance-queue"] });
      queryClient.invalidateQueries({ queryKey: ["ta"] });
      review.applySaved(vars.id, vars.data);

      notify.success(
        "Review saved",
        vars.data.reviewStatus === "APPROVED"
          ? "Requirement approved."
          : vars.data.reviewStatus === "TO_FOLLOW"
          ? "Target completion date updated."
          : "Requirement rejected and marked for replacement."
      );
    },
    onError: (err: unknown) => {
      notify.error("Review failed", (err as { message?: string } | null)?.message || "Unable to save review decision.");
    },
  });

  const filteredApplications = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((app) => {
      const reqs = app.complianceRequirements || [];
      const open = reqs.filter((r) => r.reviewStatus !== "APPROVED");
      const hasCategory = (category: "OVERDUE" | "UPCOMING") =>
        open.some((r) => calculateUrgencyStatus(getFollowUpTargetDate(r)).category === category);

      let matchesUrgency = true;
      if (urgencyFilter === "READY_FOR_REVIEW") matchesUrgency = reqs.some((r) => r.reviewStatus === "SUBMITTED");
      else if (urgencyFilter === "OVERDUE") matchesUrgency = hasCategory("OVERDUE");
      else if (urgencyFilter === "UPCOMING") matchesUrgency = hasCategory("UPCOMING");
      else if (urgencyFilter === "HEALTHY") matchesUrgency = getWorkerUrgencyCategory(app) === "HEALTHY";

      const matchesSearch =
        !q ||
        workerNameOf(app).toLowerCase().includes(q) ||
        (app.user?.email || "").toLowerCase().includes(q) ||
        (app.jobPosting?.title || "").toLowerCase().includes(q) ||
        (app.jobPosting?.mrf?.client?.name || app.deployments?.[0]?.client?.name || "").toLowerCase().includes(q);

      return matchesUrgency && matchesSearch;
    });
  }, [applications, search, urgencyFilter]);

  const pagedApplications = filteredApplications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleReset = () => {
    setSearch("");
    setUrgencyFilter("ALL");
    setPage(1);
  };

  const reviewButton = (app: Application, className?: string) =>
    openRequirementsOf(app).length > 0 ? (
      <Button variant="outline" size="sm" className={className} onClick={() => review.open(app)}>
        Review documents
      </Button>
    ) : null;

  const tiles: ComplianceTile[] = [
    {
      id: "ALL",
      label: "Workers with follow-ups",
      value: applications.length,
      hint: `${plural(metrics.totalFollowUpDocs, "document")} open`,
    },
    {
      id: "READY_FOR_REVIEW",
      label: URGENCY_LABELS.READY_FOR_REVIEW,
      value: metrics.readyForReviewCount,
      hint: `${plural(metrics.readyForReviewDocs, "document")} to verify`,
    },
    { id: "UPCOMING", label: URGENCY_LABELS.UPCOMING, value: metrics.dueSoonCount, hint: "Next due date within 7 days", tone: "warning" },
    { id: "OVERDUE", label: URGENCY_LABELS.OVERDUE, value: metrics.overdueCount, hint: "Past the target date", tone: "danger" },
  ];

  const filters: FilterConfig[] = [
    {
      key: "urgency",
      label: "Urgency",
      placeholder: "All urgency levels",
      options: [
        { value: "READY_FOR_REVIEW", label: URGENCY_LABELS.READY_FOR_REVIEW },
        { value: "OVERDUE", label: URGENCY_LABELS.OVERDUE },
        { value: "UPCOMING", label: URGENCY_LABELS.UPCOMING },
        { value: "HEALTHY", label: URGENCY_LABELS.HEALTHY },
      ],
    },
  ];

  const columns: DataTableColumn<Application>[] = [
    {
      key: "worker",
      header: "Worker",
      cell: (app) => {
        const employeeNumber = app.user?.employee?.employeeNumber || app.hiredEmployee?.employeeNumber;
        return (
          <div>
            <Link
              to="/ta/applications/$applicationId"
              params={{ applicationId: String(app.id) }}
              className="focus-ring font-medium text-navy underline-offset-2 hover:underline"
            >
              {workerNameOf(app)}
            </Link>
            <div className="text-xs text-slate-600">{app.user?.email}</div>
            {employeeNumber && <div className="font-mono text-xs text-slate-600">{employeeNumber}</div>}
          </div>
        );
      },
    },
    { key: "site", header: "Site", cell: (app) => <SiteCell app={app} /> },
    { key: "documents", header: "Open documents", className: "min-w-[14rem]", cell: (app) => <DocumentNames app={app} /> },
    {
      key: "urgency",
      header: "Urgency",
      className: "min-w-[13rem]",
      cell: (app) => <UrgencyLine urgency={summarizeFollowUpUrgency(app.complianceRequirements || [])} />,
    },
    { key: "actions", header: "Action", align: "right", className: "whitespace-nowrap", cell: (app) => reviewButton(app) },
  ];

  const renderCard = (app: Application) => (
    <article className="space-y-2 p-4">
      <Link
        to="/ta/applications/$applicationId"
        params={{ applicationId: String(app.id) }}
        className="focus-ring inline-flex min-h-11 items-center font-semibold text-navy underline-offset-2 hover:underline"
      >
        {workerNameOf(app)}
      </Link>
      <SiteCell app={app} />
      <UrgencyLine urgency={summarizeFollowUpUrgency(app.complianceRequirements || [])} />
      <div className="text-sm">
        <DocumentNames app={app} />
      </div>
      {reviewButton(app, "w-full")}
    </article>
  );

  const header = !hideHeader && (
    <PageHeader
      title={TA_COPY.pageTitles.followUps}
      description="Documents deployed workers still owe."
      breadcrumbs={[{ label: TA_COPY.navigation.overview, href: "/ta" }, { label: TA_COPY.navigation.workforce }]}
      flush
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingState variant="table" rows={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState error={error as Error} onRetry={() => refetch()} subject="the follow-ups" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {applications.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No pending follow-up requirements"
          description="All deployed workers have verified compliance files."
        />
      ) : (
        <ComplianceQueue
          caption="Deployed workers with open follow-up documents"
          tiles={tiles}
          selectedTile={urgencyFilter === "HEALTHY" ? "" : urgencyFilter}
          onTileChange={(id) => {
            setUrgencyFilter(id as UrgencyFilter);
            setPage(1);
          }}
          searchLabel="Search workers"
          searchPlaceholder="Search worker, job title, or client"
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          filters={filters}
          filterValues={{ urgency: urgencyFilter === "ALL" ? "" : urgencyFilter }}
          onFilterChange={(key, value) => {
            if (key === "urgency") {
              setUrgencyFilter((value as UrgencyFilter) || "ALL");
              setPage(1);
            }
          }}
          onReset={handleReset}
          columns={columns}
          rows={pagedApplications}
          renderCard={renderCard}
          isFetching={isFetching}
          empty={
            <EmptyState
              bare
              title="No matching workers"
              description="No deployed workers match your search or filter."
              action={
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reset filters
                </Button>
              }
            />
          }
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={filteredApplications.length}
          onPageChange={setPage}
          itemLabel="workers"
        />
      )}

      <ComplianceReviewDialog
        session={review}
        mode="post"
        personName={workerNameOf}
        isSubmitting={reviewMutation.isPending}
        onSubmit={(values, requirement) => reviewMutation.mutate({ id: requirement.id, data: values })}
        // The rows are the full requirement objects, so the updated-copy deadline is present at runtime.
        renderListMeta={(req) => followUpDocumentUrgency(req)}
      />
    </div>
  );
};
