import React, { useState, useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  ConfirmDialog,
  BulkActionBar,
  BulkResultDialog,
  type DataTableColumn,
  type DataTableSort,
} from "../../components/common";
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
import { formatDate, displayEmail } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
import type { Application } from "../../lib/types";
import type { BulkSummary } from "../../lib/types/application.types";
import { useRowSelection } from "../../hooks/useRowSelection";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { plural } from "../../lib/plural";
import { calculateDaysOnSite } from "../../lib/compliance-queue";
import { PersonCell, StatusWithAge, ToneChip, WorkforceCard } from "../../components/ta/workforce/WorkforceRow";
import type { TAStatusTone } from "../../lib/ta-copy";

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
  return profile ? `${profile.firstName} ${profile.lastName}` : displayEmail(app.user?.email) || "Candidate";
};

/** How long the application has been in the queue, counted from stage activity. */
const stageTimestamp = (app: Application) => app.updatedAt ?? app.createdAt;

const waitingLabel = (app: Application): string => {
  const days = calculateDaysOnSite(stageTimestamp(app));
  if (days === null) return "";
  return days === 0 ? "Waiting since today" : `Waiting ${plural(days, "day")}`;
};

/** One plain sentence for where a candidate's documents stand. Amber only when the TA has work to do. */
const progressOf = (app: Application): { text: string; className: string; tone: TAStatusTone } => {
  const c = getComplianceCounts(app);
  if (c.submittedCount > 0) {
    return { text: `${c.submittedCount} awaiting review`, className: "font-medium text-amber-800", tone: "warning" };
  }
  if (c.pendingCount > 0) {
    return {
      text: `${c.pendingCount} not submitted${c.toFollowCount > 0 ? ` · ${c.toFollowCount} to follow` : ""}`,
      className: "text-slate-700",
      tone: "neutral",
    };
  }
  if (isCleared(c)) {
    return {
      text: c.toFollowCount > 0 ? `Cleared · ${c.toFollowCount} to follow` : `All ${c.approvedCount} approved`,
      className: "text-emerald-800",
      tone: "success",
    };
  }
  if (c.toFollowCount > 0) return { text: `${c.toFollowCount} to follow`, className: "text-amber-800", tone: "warning" };
  return { text: "No requirements", className: "text-slate-600", tone: "neutral" };
};

const readStatusParam = (raw: unknown): StatusFilter => {
  if (raw === "SUBMITTED" || raw === "WAITING_REVIEW") return "WAITING_REVIEW";
  if (raw === "WAITING_CANDIDATE" || raw === "APPROVED" || raw === "TO_FOLLOW") return raw;
  return "ALL";
};

const readSortParam = (raw: unknown): DataTableSort => {
  if (raw === "candidate_asc") return { key: "candidate", direction: "asc" };
  if (raw === "candidate_desc") return { key: "candidate", direction: "desc" };
  if (raw === "submitted_desc") return { key: "submitted", direction: "desc" };
  return { key: "submitted", direction: "asc" };
};

const encodeSortParam = (s: DataTableSort): string | undefined => {
  if (s.key === "candidate") return s.direction === "asc" ? "candidate_asc" : "candidate_desc";
  if (s.key === "submitted" && s.direction === "desc") return "submitted_desc";
  return undefined;
};

export const CompliancePage: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;

  const syncUrl = (patch: Record<string, unknown>) => {
    void navigate({
      to: "/ta/requirements",
      search: ((prev: Record<string, unknown>) => ({ ...prev, ...patch })) as never,
      replace: true,
    });
  };

  const [search, setSearch] = useState(() => (typeof searchParams.q === "string" ? searchParams.q : ""));
  const [jobTitleFilter, setJobTitleFilter] = useState(() =>
    typeof searchParams.jobTitle === "string" ? searchParams.jobTitle : ""
  );
  const [clientFilter, setClientFilter] = useState(() =>
    typeof searchParams.clientId === "string" ? searchParams.clientId : ""
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => readStatusParam(searchParams.status));
  // Oldest waiting first: the review queue starts with whoever has waited longest.
  const [sort, setSort] = useState<DataTableSort>(() => readSortParam(searchParams.sort));
  const [queuePage, setQueuePage] = useState(() => {
    const parsed = Number(searchParams.page);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const parsed = Number(searchParams.pageSize);
    return parsed === 10 || parsed === 25 || parsed === 50 ? parsed : PAGE_SIZE;
  });
  const [confirmAdvanceApp, setConfirmAdvanceApp] = useState<Application | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    title: string;
    summary: BulkSummary;
    names: Record<number, string>;
  } | null>(null);

  const selection = useRowSelection(
    JSON.stringify([queuePage, pageSize, search, jobTitleFilter, clientFilter, statusFilter, sort])
  );

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

  const clientOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const app of complianceApps) {
      const client = app.jobPosting?.mrf?.client;
      if (client?.id != null && client.name) byId.set(String(client.id), client.name);
    }
    return Array.from(byId, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [complianceApps]);

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

      const matchesClient = !clientFilter || String(app.jobPosting?.mrf?.client?.id ?? "") === clientFilter;

      return matchesStatus && matchesSearch && matchesJobTitle && matchesClient;
    });
  }, [complianceApps, statusFilter, search, jobTitleFilter, clientFilter]);

  const sortedApps = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filteredApps].sort((a, b) => {
      const comparison =
        sort.key === "candidate"
          ? candidateNameOf(a).localeCompare(candidateNameOf(b))
          : (new Date(stageTimestamp(a)).getTime() || 0) - (new Date(stageTimestamp(b)).getTime() || 0);
      return comparison * direction;
    });
  }, [filteredApps, sort]);

  const pagedApps = sortedApps.slice((queuePage - 1) * pageSize, queuePage * pageSize);
  const selectedRows = pagedApps.filter(
    (app) => selection.selectedIds.has(String(app.id)) && isCleared(getComplianceCounts(app))
  );

  const handleReset = () => {
    setSearch("");
    setJobTitleFilter("");
    setClientFilter("");
    setStatusFilter("ALL");
    setQueuePage(1);
    syncUrl({ q: undefined, jobTitle: undefined, clientId: undefined, status: undefined, page: undefined });
  };

  const bulkAdvanceMutation = useMutation({
    mutationFn: (rows: Application[]) =>
      taApi.bulkAdvanceToContractSigning({ ids: rows.map((app) => app.id) }),
    onSuccess: (summary, rows) => {
      queryClient.invalidateQueries({ queryKey: ["ta"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics", "compliance"] });
      selection.remove(summary.results.filter((row) => row.ok).map((row) => String(row.id)));
      const title = "Move to contract signing";
      if (summary.failed > 0 || summary.results.some((row) => row.reason)) {
        setBulkResult({
          title,
          summary,
          names: Object.fromEntries(rows.map((app) => [app.id, candidateNameOf(app)])),
        });
      } else {
        notify.success(
          "Stage updated",
          `${summary.succeeded} ${summary.succeeded === 1 ? "candidate" : "candidates"} moved to Contract signing.`
        );
      }
    },
    onError: (err: unknown) => {
      notify.error("Unable to move candidates", err);
    },
  });

  const advanceMutation = useMutation({
    mutationFn: (appId: number) =>
      taApi.updateApplicationStatus(String(appId), {
        status: ApplicationStatus.CONTRACT_SIGNING,
        reason: "All mandatory pre-employment requirements approved.",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics", "compliance"] });
      setConfirmAdvanceApp(null);
      notify.success("Stage updated", "Candidate moved to Contract signing.");
    },
    onError: (err: unknown) => {
      notify.error("Unable to move candidate", err);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      applicationId,
      advanceToContractSigning,
    }: {
      id: number;
      data: RequirementReviewValues;
      applicationId?: number;
      advanceToContractSigning?: boolean;
    }) => {
      await taApi.reviewComplianceRequirement(id, data);
      if (advanceToContractSigning && applicationId != null) {
        await taApi.updateApplicationStatus(String(applicationId), {
          status: ApplicationStatus.CONTRACT_SIGNING,
          reason: "All mandatory pre-employment requirements approved.",
        });
      }
    },
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
      if (vars.advanceToContractSigning) {
        review.close();
        notify.success("Stage updated", "Candidate moved to Contract signing.");
      }
    },
    onError: (err: unknown) => {
      notify.error("Review failed", err);
    },
  });

  const clearedButton = (app: Application, className?: string) => (
    <Button
      variant="primary"
      size="sm"
      className={className}
      onClick={() => setConfirmAdvanceApp(app)}
    >
      Move to contract signing
    </Button>
  );

  const reviewButton = (app: Application, className?: string) =>
    openRequirementsOf(app).length > 0 ? (
      <Button variant="outline" size="sm" className={className} onClick={() => review.open(app)}>
        Review documents
      </Button>
    ) : (
      clearedButton(app, className)
    );

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
    { key: "clientId", label: "Client", placeholder: "All clients", searchable: true, options: clientOptions },
    { key: "jobTitle", label: "Job opening", placeholder: "All job openings", searchable: true, options: jobTitleOptions },
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

  const contextOf = (app: Application) => [app.jobPosting?.title || "Job opening", app.jobPosting?.mrf?.client?.name];

  const statusCell = (app: Application) => {
    const progress = progressOf(app);
    return <StatusWithAge chip={<ToneChip tone={progress.tone}>{progress.text}</ToneChip>} age={waitingLabel(app)} />;
  };

  const columns: DataTableColumn<Application>[] = [
    {
      key: "candidate",
      header: "Candidate",
      sortable: true,
      cell: (app) => <PersonCell name={candidateNameOf(app)} context={contextOf(app)} href={`/ta/applications/${app.id}`} />,
    },
    { key: "progress", header: "Documents", cell: statusCell },
    {
      key: "submitted",
      header: "Waiting",
      sortable: true,
      hideBelow: "lg",
      cell: (app) => <span className="text-xs text-slate-700">Since {formatDate(stageTimestamp(app))}</span>,
    },
    { key: "actions", header: "Action", align: "right", className: "whitespace-nowrap", cell: (app) => reviewButton(app) },
  ];

  const renderCard = (app: Application) => (
    <WorkforceCard
      href={`/ta/applications/${app.id}`}
      name={candidateNameOf(app)}
      context={contextOf(app)}
      status={statusCell(app)}
      action={reviewButton(app, "w-full")}
    />
  );

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
            const nextStatus = id as StatusFilter;
            setStatusFilter(nextStatus);
            setQueuePage(1);
            syncUrl({ status: nextStatus === "ALL" ? undefined : nextStatus, page: undefined });
          }}
          searchLabel="Search candidates"
          searchPlaceholder="Search candidate, email, or job opening"
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setQueuePage(1);
            syncUrl({ q: value.trim() || undefined, page: undefined });
          }}
          filters={filters}
          filterValues={{ clientId: clientFilter, jobTitle: jobTitleFilter, requirementStatus: statusFilter !== "ALL" ? statusFilter : "" }}
          onFilterChange={(key, value) => {
            if (key === "clientId") {
              setClientFilter(value);
              syncUrl({ clientId: value || undefined, page: undefined });
            } else if (key === "jobTitle") {
              setJobTitleFilter(value);
              syncUrl({ jobTitle: value || undefined, page: undefined });
            } else if (key === "requirementStatus") {
              const nextStatus = (value as StatusFilter) || "ALL";
              setStatusFilter(nextStatus);
              syncUrl({ status: nextStatus === "ALL" ? undefined : nextStatus, page: undefined });
            }
            setQueuePage(1);
          }}
          onReset={handleReset}
          columns={columns}
          rows={pagedApps}
          renderCard={renderCard}
          renderClearedAction={(app) => clearedButton(app)}
          selection={{
            selectedIds: selection.selectedIds,
            onChange: selection.setSelectedIds,
            rowLabel: (app) => `Select ${candidateNameOf(app)}`,
            isRowSelectable: (app) => isCleared(getComplianceCounts(app)),
          }}
          bulkBar={
            <BulkActionBar count={selectedRows.length} onClear={selection.clear}>
              <Button
                size="sm"
                variant="primary"
                loading={bulkAdvanceMutation.isPending}
                onClick={() => bulkAdvanceMutation.mutate(selectedRows)}
              >
                Move to contract signing
              </Button>
            </BulkActionBar>
          }
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setQueuePage(1);
            syncUrl({ sort: encodeSortParam(next), page: undefined });
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
          pageSize={pageSize}
          totalItems={sortedApps.length}
          onPageChange={(nextPage) => {
            setQueuePage(nextPage);
            syncUrl({ page: nextPage > 1 ? nextPage : undefined });
          }}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setQueuePage(1);
            syncUrl({ pageSize: nextSize, page: undefined });
          }}
          itemLabel="candidates"
        />
      )}

      <ComplianceReviewDialog
        session={review}
        mode="pre"
        personName={candidateNameOf}
        canAutoAdvanceToContractSigning
        isSubmitting={reviewMutation.isPending}
        onSubmit={(values, requirement, options) =>
          reviewMutation.mutate({
            id: requirement.id,
            data: values,
            applicationId: review.application?.id,
            advanceToContractSigning: options?.advanceToContractSigning,
          })
        }
      />

      <ConfirmDialog
        open={Boolean(confirmAdvanceApp)}
        onClose={() => setConfirmAdvanceApp(null)}
        onConfirm={() => confirmAdvanceApp && advanceMutation.mutate(confirmAdvanceApp.id)}
        title="Move to contract signing?"
        description={
          confirmAdvanceApp
            ? `${candidateNameOf(confirmAdvanceApp)} has all mandatory pre-employment requirements cleared. Move them to Contract signing?`
            : ""
        }
        confirmLabel="Move to contract signing"
        loading={advanceMutation.isPending}
      />

      <BulkResultDialog
        open={Boolean(bulkResult)}
        onClose={() => setBulkResult(null)}
        title={bulkResult?.title ?? ""}
        summary={bulkResult?.summary ?? null}
        labelFor={(id) => bulkResult?.names[id] ?? `Application ${id}`}
      />
    </div>
  );
};
