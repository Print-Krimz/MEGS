import React, { useState, useMemo } from "react";
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
import type { Application } from "../../lib/types";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { plural } from "../../lib/plural";
import { displayEmail } from "../../lib/utils";
import { calculateUrgencyStatus, getFollowUpTargetDate, getWorkerUrgencyCategory } from "../../lib/compliance-queue";
import { PersonCell, StatusWithAge, ToneChip, WorkforceCard } from "../../components/ta/workforce/WorkforceRow";

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
  return name || displayEmail(app.user?.email) || "Worker";
};

const clientNameOf = (app: Application): string =>
  app.jobPosting?.mrf?.client?.name || app.deployments?.[0]?.client?.name || "Client not recorded";

const URGENCY_TONE = { overdue: "danger", upcoming: "warning", later: "neutral", none: "neutral" } as const;

/** One chip for the worst open follow-up, with the next due date underneath. */
const UrgencyStatus: React.FC<{ urgency: FollowUpUrgency }> = ({ urgency }) => (
  <StatusWithAge
    chip={
      <ToneChip tone={URGENCY_TONE[urgency.tone]}>
        {urgency.tone === "overdue" && <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        {urgency.text}
      </ToneChip>
    }
    age={urgency.nextDue ? `Next due ${urgency.nextDue}` : undefined}
  />
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
    { id: "UPCOMING", label: URGENCY_LABELS.UPCOMING, value: metrics.dueSoonCount, hint: "Next due within 7 days", tone: "warning" },
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

  const contextOf = (app: Application) => [app.jobPosting?.title || "Job opening", clientNameOf(app)];

  const columns: DataTableColumn<Application>[] = [
    {
      key: "worker",
      header: "Worker",
      cell: (app) => <PersonCell name={workerNameOf(app)} context={contextOf(app)} href={`/ta/applications/${app.id}`} />,
    },
    {
      key: "urgency",
      header: "Urgency",
      className: "min-w-[13rem]",
      cell: (app) => <UrgencyStatus urgency={summarizeFollowUpUrgency(app.complianceRequirements || [])} />,
    },
    { key: "documents", header: "Open documents", hideBelow: "lg", className: "min-w-[14rem]", cell: (app) => <DocumentNames app={app} /> },
    { key: "actions", header: "Action", align: "right", className: "whitespace-nowrap", cell: (app) => reviewButton(app) },
  ];

  const renderCard = (app: Application) => (
    <WorkforceCard
      href={`/ta/applications/${app.id}`}
      name={workerNameOf(app)}
      context={contextOf(app)}
      status={<UrgencyStatus urgency={summarizeFollowUpUrgency(app.complianceRequirements || [])} />}
      details={<DocumentNames app={app} />}
      action={reviewButton(app, "w-full")}
    />
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
