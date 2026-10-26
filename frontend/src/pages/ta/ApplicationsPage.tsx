import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, X } from "lucide-react";
import { keepPreviousData, useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  StatusBadge,
  ScoreBadge,
  SearchFilters,
  Pagination,
  LoadingState,
  ErrorState,
  EmptyState,
  ActionMenu,
  DataTable,
  BulkActionBar,
  BulkResultDialog,
  type DataTableColumn,
} from "../../components/common";
import { Button, ComboBox, Dialog, Textarea } from "../../components/ui";
import { formatDate, getApplicationStatusMeta, displayEmail } from "../../lib/utils";
import { StageStrip, STAGE_STRIP_STAGES, type StageStripItem } from "../../components/ta/recruitment/StageStrip";
import {
  ApplicationStatus,
  PIPELINE_FILTER_STAGES,
} from "../../lib/types/enums";
import { notify } from "../../lib/feedback";
import type { BulkSummary, ReturningWorkerInfo, TAApplicationSummary, WalkInSlip } from "../../lib/types/application.types";
import {
  BULK_ACTION_TITLES,
  BulkApplicationsDialog,
  type BulkApplicationAction,
  type BulkSubmission,
} from "../../components/ta/BulkApplicationsDialog";
import { useRowSelection } from "../../hooks/useRowSelection";
import type { ApplicationSourceFilter, TAApplicationSearch } from "../../routes";
import { SourceChip, APPLICATION_SOURCE_LABELS } from "../../components/ta/walk-in/SourceChip";
import { EncodeSeveralWalkInsDialog } from "../../components/ta/walk-in/EncodeSeveralWalkInsDialog";
import { WalkInSlipDialog } from "../../components/ta/walk-in/WalkInSlipDialog";
import { CheckInsPanel, useCheckIns } from "../../components/ta/walk-in/CheckInsPanel";
import { CheckInPosterDialog } from "../../components/ta/walk-in/CheckInPoster";
import { TA_COPY } from "../../lib/ta-copy";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  normalizeServerSearch,
  REFERENCE_QUERY_STALE_TIME_MS,
  SERVER_SEARCH_DEBOUNCE_MS,
} from "../../lib/query-policies";

const EMPTY_LIST: any[] = [];

const ReturningBadge: React.FC<{ info?: ReturningWorkerInfo | null }> = ({ info }) => {
  if (!info) return null;
  const title = info.sameClient
    ? `Previously deployed at ${info.clientName}. Screening is skipped and the application goes straight to Requirements.`
    : `Previously deployed at ${info.clientName}. This is a different client, so the full process applies.`;
  return (
    <span
      title={title}
      className={`inline-flex max-w-[18rem] items-center rounded border px-1.5 py-0.5 text-xs font-medium ${
        info.sameClient ? "border-navy-line bg-navy-soft text-navy" : "border-slate-300 bg-slate-50 text-slate-700"
      }`}
    >
      <span className="truncate">
        {info.sameClient ? "Redeployment" : "Previously deployed"} · {info.clientName}
      </span>
    </span>
  );
};

const ScreeningSkippedNote: React.FC<{ info?: ReturningWorkerInfo | null }> = ({ info }) =>
  info?.sameClient ? (
    <div
      className="mt-1 text-xs text-slate-600"
      title="Prior placement at this client: screening and interview stages were skipped."
    >
      Screening skipped
    </div>
  ) : null;

/** Records that are already closed (or archived) can be archived or restored from the list. Open records are closed from the detail page. */
const CLOSED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.BACKOUT,
  ApplicationStatus.TALENT_POOL,
  ApplicationStatus.ARCHIVED,
];

/** The next TA action, derived from the stage and the counts the list already returns. */
const nextStepFor = (app: TAApplicationSummary): string => {
  if (app.isArchived) return "None";
  switch (app.status) {
    case ApplicationStatus.SUBMITTED:
    case ApplicationStatus.PARSING:
    case ApplicationStatus.REVIEW:
    case ApplicationStatus.NEEDS_ATTENTION:
    case ApplicationStatus.MATCHED:
      return "Review application";
    case ApplicationStatus.INITIAL_SCREENING:
      return app.interviewCount > 0 ? "Record screening outcome" : "Schedule screening";
    case ApplicationStatus.CLIENT_ENDORSEMENT:
      return "Record client decision";
    case ApplicationStatus.FINAL_INTERVIEW:
      return "Schedule final interview";
    case ApplicationStatus.HIRED:
      return "Start requirements";
    case ApplicationStatus.COMPLIANCE:
      return "Review documents";
    case ApplicationStatus.ONBOARDING:
    case ApplicationStatus.CONTRACT_SIGNING:
      return "Upload signed contract";
    default:
      return "None";
  }
};

type ListSort = NonNullable<TAApplicationSearch["sort"]>;
const SORT_OPTIONS = [
  { value: "match", label: "Sort: Best match" },
  { value: "newest", label: "Sort: Newest first" },
  { value: "oldest", label: "Sort: Oldest first" },
  { value: "waiting", label: "Sort: Longest in stage" },
];

const daysInStageLabel = (days?: number) => {
  if (days == null) return "-";
  if (days <= 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
};

const candidateNameOf = (app: TAApplicationSummary) => {
  const p = app.user?.applicantProfile;
  const name = p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : "";
  return name || displayEmail(app.user?.email) || "Candidate";
};

const isClosedRecord = (app: TAApplicationSummary) =>
  Boolean(app.isArchived) || CLOSED_STATUSES.includes(app.status);

const readApplicationSearch = (): TAApplicationSearch => {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const stage = params.get("stage");
  const sortParam = params.get("sort");
  const number = (value: string | null) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  };
  return {
    q: params.get("q") || undefined,
    stage: stage && PIPELINE_FILTER_STAGES.includes(stage as ApplicationStatus) ? stage as ApplicationStatus : undefined,
    clientId: number(params.get("clientId")),
    jobId: number(params.get("jobId")),
    archived: params.get("archived") === "true" || params.get("archived") === "1" ? true : undefined,
    returning: params.get("returning") === "true" || params.get("returning") === "1" ? true : undefined,
    sort: sortParam === "newest" || sortParam === "oldest" || sortParam === "waiting" ? sortParam : undefined,
    needsAction: params.get("needsAction") === "true" || params.get("needsAction") === "1" ? true : undefined,
    page: number(params.get("page")),
  };
};

export const ApplicationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Re-read on router renders so browser back/forward and in-place search
  // navigation restore the visible filters instead of keeping a stale snapshot.
  const routeSearch = readApplicationSearch();

  const [page, setPage] = useState(routeSearch.page || 1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState(routeSearch.q || "");
  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => ({
    ...(routeSearch.stage ? { status: routeSearch.stage } : {}),
    ...(routeSearch.clientId ? { clientId: String(routeSearch.clientId) } : {}),
    ...(routeSearch.jobId ? { jobId: String(routeSearch.jobId) } : {}),
    ...(routeSearch.source ? { source: routeSearch.source } : {}),
  }));
  const [showArchived, setShowArchived] = useState(Boolean(routeSearch.archived));
  const [returningOnly, setReturningOnly] = useState(Boolean(routeSearch.returning));
  const [sort, setSort] = useState<ListSort | undefined>(routeSearch.sort);
  const [needsAction, setNeedsAction] = useState(Boolean(routeSearch.needsAction));

  useEffect(() => {
    setPage(routeSearch.page || 1);
    setSearch(routeSearch.q || "");
    setFilterValues({
      ...(routeSearch.stage ? { status: routeSearch.stage } : {}),
      ...(routeSearch.clientId ? { clientId: String(routeSearch.clientId) } : {}),
      ...(routeSearch.jobId ? { jobId: String(routeSearch.jobId) } : {}),
      ...(routeSearch.source ? { source: routeSearch.source } : {}),
    });
    setShowArchived(Boolean(routeSearch.archived));
    setReturningOnly(Boolean(routeSearch.returning));
    setSort(routeSearch.sort);
    setNeedsAction(Boolean(routeSearch.needsAction));
  }, [routeSearch.page, routeSearch.q, routeSearch.stage, routeSearch.clientId, routeSearch.jobId, routeSearch.archived, routeSearch.returning, routeSearch.sort, routeSearch.needsAction, routeSearch.source]);

  const updateListUrl = (next: Partial<TAApplicationSearch>) => {
    const valueFor = <K extends keyof TAApplicationSearch>(key: K, fallback: TAApplicationSearch[K]) =>
      Object.prototype.hasOwnProperty.call(next, key) ? next[key] : fallback;
    void navigate({
      to: "/ta/applications",
      search: {
        q: valueFor("q", search || undefined),
        stage: valueFor("stage", filterValues.status as ApplicationStatus | undefined),
        clientId: valueFor("clientId", filterValues.clientId ? Number(filterValues.clientId) : undefined),
        jobId: valueFor("jobId", filterValues.jobId ? Number(filterValues.jobId) : undefined),
        source: valueFor("source", filterValues.source as ApplicationSourceFilter | undefined),
        archived: valueFor("archived", showArchived || undefined),
        returning: valueFor("returning", returningOnly || undefined),
        sort: valueFor("sort", sort),
        needsAction: valueFor("needsAction", needsAction || undefined),
        page: valueFor("page", page > 1 ? page : undefined),
      },
      replace: true,
    });
  };

  const listSearch = {
    q: search || undefined,
    stage: (filterValues.status as ApplicationStatus | undefined) || undefined,
    clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
    jobId: filterValues.jobId ? Number(filterValues.jobId) : undefined,
    source: (filterValues.source as ApplicationSourceFilter | undefined) || undefined,
    archived: showArchived || undefined,
    returning: returningOnly || undefined,
    sort,
    needsAction: needsAction || undefined,
    page: page > 1 ? page : undefined,
  };

  const [encodeOpen, setEncodeOpen] = useState(false);
  // Slip for a confirmed self check-in (encoding prints its own A4 slips).
  const [walkInSlip, setWalkInSlip] = useState<WalkInSlip | null>(null);
  const [posterOpen, setPosterOpen] = useState(false);
  const [view, setView] = useState<"applications" | "check-ins">("applications");
  const checkInCount = useCheckIns().data?.items.length ?? 0;

  // Modal states for archive
  const [archiveModalApp, setArchiveModalApp] = useState<{ id: number; name: string; isArchived: boolean } | null>(null);
  const [archiveReason, setArchiveReason] = useState("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const applicationsQuery = useQuery({
    queryKey: ["ta", "applications", {
      page,
      pageSize,
      search: debouncedSearch,
      status: filterValues.status || "",
      clientId: filterValues.clientId || "",
      jobId: filterValues.jobId || "",
      source: filterValues.source || "",
      showArchived,
      returningOnly,
      sort: sort ?? "match",
      needsAction,
    }],
    queryFn: ({ signal }) =>
      taApi.listApplicationsPage({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: (filterValues.status as ApplicationStatus) || undefined,
        jobId: filterValues.jobId ? Number(filterValues.jobId) : undefined,
        clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
        source: (filterValues.source as ApplicationSourceFilter) || undefined,
        isArchived: showArchived,
        returning: returningOnly || undefined,
        sort,
        needsAction: needsAction || undefined,
        summary: true,
      }, { signal }),
    placeholderData: keepPreviousData,
  });

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", "dropdown"],
    queryFn: ({ signal }) => taApi.listJobs({}, { signal }),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: ({ signal }) => taApi.listClients({ signal }),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  // Counts for the stage strip honour every filter except the stage itself.
  const stageStripValues = React.useMemo(() => {
    const current = filterValues.status;
    const known = (STAGE_STRIP_STAGES as readonly string[]).includes(current ?? "");
    return ["", ...STAGE_STRIP_STAGES, ...(current && !known ? [current] : [])];
  }, [filterValues.status]);
  const stageCountQueries = useQueries({
    queries: stageStripValues.map((stage) => ({
      queryKey: ["ta", "applications", "stage-count", {
        stage,
        search: debouncedSearch,
        clientId: filterValues.clientId || "",
        jobId: filterValues.jobId || "",
        source: filterValues.source || "",
        returningOnly,
        needsAction,
      }],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        taApi
          .listApplicationsPage({
            page: 1,
            limit: 1,
            search: debouncedSearch || undefined,
            status: (stage as ApplicationStatus) || undefined,
            jobId: filterValues.jobId ? Number(filterValues.jobId) : undefined,
            clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
            source: (filterValues.source as ApplicationSourceFilter) || undefined,
            isArchived: false,
            returning: returningOnly || undefined,
            needsAction: needsAction || undefined,
            summary: true,
          }, { signal })
          .then((result) => result.total),
      placeholderData: keepPreviousData,
      staleTime: 30_000,
    })),
  });
  const stageStripItems: StageStripItem[] = stageStripValues.map((stage, index) => ({
    value: stage,
    label: stage ? getApplicationStatusMeta(stage).label : "All",
    count: stageCountQueries[index]?.data,
  }));

  // Mutations
  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      taApi.archiveApplication(id, { reason }),
    onSuccess: (_, vars) => {
      queryClient.setQueriesData<any>({ queryKey: ["ta", "applications"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((item) => (item.id === vars.id ? { ...item, isArchived: true, status: ApplicationStatus.ARCHIVED } : item));
        }
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((item: any) => (item.id === vars.id ? { ...item, isArchived: true, status: ApplicationStatus.ARCHIVED } : item)),
          };
        }
        if (Array.isArray(old.items)) {
          return {
            ...old,
            items: old.items.map((item: any) => (item.id === vars.id ? { ...item, isArchived: true, status: ApplicationStatus.ARCHIVED } : item)),
          };
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", String(vars.id)] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      setArchiveModalApp(null);
      setArchiveReason("");
      const msg = "Application archived successfully.";
      setFeedback({ type: "success", message: msg });
      notify.success("Application Archived", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to archive this application. Please try again." });
      notify.error("Unable to archive application", err);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      taApi.restoreApplication(id, { reason }),
    onSuccess: (_, vars) => {
      queryClient.setQueriesData<any>({ queryKey: ["ta", "applications"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((item) => (item.id === vars.id ? { ...item, isArchived: false, status: ApplicationStatus.SUBMITTED } : item));
        }
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((item: any) => (item.id === vars.id ? { ...item, isArchived: false, status: ApplicationStatus.SUBMITTED } : item)),
          };
        }
        if (Array.isArray(old.items)) {
          return {
            ...old,
            items: old.items.map((item: any) => (item.id === vars.id ? { ...item, isArchived: false, status: ApplicationStatus.SUBMITTED } : item)),
          };
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", String(vars.id)] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      setArchiveModalApp(null);
      setArchiveReason("");
      const msg = "Application restored to pipeline.";
      setFeedback({ type: "success", message: msg });
      notify.success("Application Restored", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to restore this application. Please try again." });
      notify.error("Unable to restore application", err);
    },
  });

  const queryData = applicationsQuery.data;
  const applications = queryData?.items ?? [];

  // Bulk actions. Selection is dropped whenever the visible list changes (filters, page, sort).
  const selection = useRowSelection(
    JSON.stringify([page, pageSize, debouncedSearch, filterValues, showArchived, returningOnly, sort, needsAction])
  );
  const selectedRows = applications.filter((app) => selection.selectedIds.has(String(app.id)));
  const [bulkAction, setBulkAction] = useState<BulkApplicationAction | null>(null);
  const [bulkResult, setBulkResult] = useState<{ title: string; summary: BulkSummary } | null>(null);

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids, data }: { action: BulkApplicationAction; ids: number[]; data: BulkSubmission }) => {
      switch (action) {
        case "reject":
          return taApi.bulkRejectApplications({
            ids,
            reasonCode: data.reasonCode ?? "",
            disposition: data.disposition ?? "ARCHIVE",
            notes: data.notes,
          });
        case "archive":
          return taApi.bulkArchiveApplications({ ids, reason: data.reason ?? "" });
        case "restore":
          return taApi.bulkRestoreApplications({ ids, reason: data.reason ?? "" });
      }
    },
    onSuccess: (summary, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      // Only the rows that went through leave the selection, so the failed ones can be reviewed.
      selection.remove(summary.results.filter((row) => row.ok).map((row) => String(row.id)));
      setBulkAction(null);
      const title = BULK_ACTION_TITLES[vars.action];
      if (summary.failed > 0) setBulkResult({ title, summary });
      else notify.success(title, `${summary.succeeded} ${summary.succeeded === 1 ? "application" : "applications"} done.`);
    },
    onError: (err: any) => notify.error("Unable to complete the bulk action", err),
  });

  const bulkActions: { action: BulkApplicationAction; label: string; variant: "primary" | "outline" | "danger" }[] = [];
  if (selectedRows.length > 0) {
    const every = (test: (app: TAApplicationSummary) => boolean) => selectedRows.every(test);
    // Same rule as the application page: a deployed worker is not rejected. End the assignment or record a backout.
    if (every((app) => !isClosedRecord(app) && app.status !== ApplicationStatus.DEPLOYED)) {
      bulkActions.push({ action: "reject", label: "Reject", variant: "outline" });
    }
    if (every((app) => isClosedRecord(app) && !app.isArchived)) {
      bulkActions.push({ action: "archive", label: "Archive", variant: "outline" });
    }
    if (every((app) => Boolean(app.isArchived))) {
      bulkActions.push({ action: "restore", label: "Restore", variant: "primary" });
    }
  }
  const bulkLabelFor = (id: number) => {
    const app = applications.find((row) => row.id === id);
    return app ? candidateNameOf(app) : `Application ${id}`;
  };
  const totalItems = queryData?.total ?? 0;
  const totalPages = queryData?.totalPages ?? 1;
  const jobs = jobsQuery.data ?? EMPTY_LIST;
  const clients = clientsQuery.data ?? EMPTY_LIST;

  // Dynamically derive client options for current TA scope (deduplicated)
  const availableClients = React.useMemo(() => {
    const seen = new Set<number>();
    const list: typeof clients = [];
    clients.forEach((c) => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        list.push(c);
      }
    });
    return list;
  }, [clients]);

  const filteredJobs = React.useMemo(() => {
    return filterValues.clientId
      ? jobs.filter((j: any) => j.mrf?.clientId === Number(filterValues.clientId))
      : jobs;
  }, [jobs, filterValues.clientId]);


  const hasListFilters = Boolean(search) || returningOnly || Object.keys(filterValues).length > 0;
  const activeFilterCount =
    (search ? 1 : 0) + (returningOnly ? 1 : 0) + (needsAction ? 1 : 0) + (sort ? 1 : 0) + Object.keys(filterValues).length;
  const hasActiveFilters = activeFilterCount > 0;
  // Only "Needs action" is hiding rows, so the empty state can say so directly.
  const onlyNeedsActionActive = needsAction && !hasListFilters;

  const changeStage = (stage: string) => {
    const nextValues = { ...filterValues };
    if (stage) nextValues.status = stage;
    else delete nextValues.status;
    setFilterValues(nextValues);
    setPage(1);
    updateListUrl({ stage: (stage as ApplicationStatus) || undefined, page: undefined });
  };

  const resetFilters = () => {
    setSearch("");
    setFilterValues({});
    setReturningOnly(false);
    setNeedsAction(false);
    setSort(undefined);
    setPage(1);
    updateListUrl({
      returning: undefined,
      q: undefined,
      stage: undefined,
      clientId: undefined,
      jobId: undefined,
      source: undefined,
      sort: undefined,
      needsAction: undefined,
      page: undefined,
    });
  };

  const openArchiveDialog = (app: TAApplicationSummary) =>
    setArchiveModalApp({ id: app.id, name: candidateNameOf(app), isArchived: Boolean(app.isArchived) });

  const detailLink = (app: TAApplicationSummary) => (
    <Link
      to="/ta/applications/$applicationId"
      params={{ applicationId: String(app.id) }}
      search={listSearch}
      className="inline-flex items-center gap-0.5 font-semibold text-navy underline underline-offset-2 hover:text-navy-hover focus-ring pointer-coarse:min-h-11"
    >
      {candidateNameOf(app)}
      <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </Link>
  );

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      notify.success("Email copied", email);
    } catch {
      notify.error("Unable to copy email", "Copy it from the candidate record instead.");
    }
  };

  const viewButton = (app: TAApplicationSummary, className?: string) => (
    <Button asChild variant="outline" size="sm" className={`whitespace-nowrap ${className ?? ""}`}>
      <Link
        to="/ta/applications/$applicationId"
        params={{ applicationId: String(app.id) }}
        search={listSearch}
        aria-label={`View application for ${candidateNameOf(app)}`}
      >
        View application
      </Link>
    </Button>
  );

  const rowMenu = (app: TAApplicationSummary) => {
    const email = displayEmail(app.user?.email);
    const jobId = app.jobPosting?.id;
    return (
      <ActionMenu
        label={`More actions for ${candidateNameOf(app)}`}
        items={[
          {
            label: "Open job opening",
            disabled: jobId == null,
            onSelect: () => void navigate({ to: "/ta/jobs/$jobId", params: { jobId: String(jobId) } }),
          },
          { label: "Copy email", disabled: !email, onSelect: () => void copyEmail(email ?? "") },
          ...(isClosedRecord(app)
            ? [{ label: app.isArchived ? "Restore" : "Archive", onSelect: () => openArchiveDialog(app) }]
            : []),
        ]}
      />
    );
  };

  const columns: DataTableColumn<TAApplicationSummary>[] = [
    {
      key: "candidate",
      header: "Candidate",
      primary: true,
      cell: (app) => (
        <div className="min-w-0">
          {detailLink(app)}
          <div className="text-xs text-slate-600">{displayEmail(app.user?.email)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <SourceChip source={app.source} />
            <ReturningBadge info={app.returning} />
          </div>
        </div>
      ),
    },
    {
      key: "job",
      header: "Job opening",
      cell: (app) => (
        <div className="min-w-0">
          <div className="text-slate-900">{app.jobPosting?.title || "Job opening"}</div>
          {app.jobPosting?.mrf?.client?.name && (
            <div className="text-xs text-slate-600">{app.jobPosting.mrf.client.name}</div>
          )}
        </div>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      cell: (app) => (
        <div>
          <StatusBadge status={app.status} />
          <ScreeningSkippedNote info={app.returning} />
        </div>
      ),
    },
    {
      key: "next",
      header: "Next step",
      hideBelow: "lg",
      cell: (app) => <span className="text-sm text-slate-700">{nextStepFor(app)}</span>,
    },
    {
      key: "inStage",
      header: "In stage",
      hideBelow: "md",
      cell: (app) => (
        <span className={`whitespace-nowrap text-sm ${sort === "waiting" ? "font-medium text-slate-950" : "text-slate-700"}`}>
          {daysInStageLabel(app.daysInStage)}
        </span>
      ),
    },
    {
      key: "applied",
      header: "Applied",
      cell: (app) => <span className="whitespace-nowrap text-sm text-slate-700">{formatDate(app.createdAt)}</span>,
    },
    {
      key: "score",
      header: "Match score",
      align: "center",
      cell: (app) => {
        const score = app.candidateFitScore ?? app.aiScore;
        return <ScoreBadge score={score == null ? score : Math.round(score)} size="sm" />;
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (app) => (
        <div className="flex items-center justify-end gap-2">
          {viewButton(app)}
          {rowMenu(app)}
        </div>
      ),
    },
  ];

  const renderCard = (app: TAApplicationSummary) => (
    <article className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words">
            {detailLink(app)}
          </h2>
          <p className="mt-0.5 break-words text-sm text-slate-600">
            {app.jobPosting?.title || "Job opening"}
            {app.jobPosting?.mrf?.client?.name ? ` · ${app.jobPosting.mrf.client.name}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <SourceChip source={app.source} />
            <ReturningBadge info={app.returning} />
          </div>
        </div>
        <div className="text-right">
          <StatusBadge status={app.status} />
          <ScreeningSkippedNote info={app.returning} />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-slate-600">In stage</dt>
          <dd className={`mt-0.5 text-slate-800 ${sort === "waiting" ? "font-medium" : ""}`}>{daysInStageLabel(app.daysInStage)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Next step</dt>
          <dd className="mt-0.5 text-slate-800">{nextStepFor(app)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Applied</dt>
          <dd className="mt-0.5 text-slate-800">{formatDate(app.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Match score</dt>
          <dd className="mt-0.5">
            <ScoreBadge
              score={(app.candidateFitScore ?? app.aiScore) == null ? undefined : Math.round((app.candidateFitScore ?? app.aiScore) as number)}
              size="sm"
            />
          </dd>
        </div>
      </dl>
      <div className="flex items-center gap-2 border-t border-slate-200 pt-3">
        {viewButton(app, "min-h-11 flex-1")}
        {rowMenu(app)}
      </div>
    </article>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={TA_COPY.pageTitles.applications}
                breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.applications },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPosterOpen(true)}>
              Print check-in poster
            </Button>
            <Button onClick={() => setEncodeOpen(true)}>Encode walk-in</Button>
          </div>
        }
        flush
      />

      {/* Mounted only while open: the encode form's unsaved-changes guard should not run on every page view. */}
      {encodeOpen && <EncodeSeveralWalkInsDialog open onClose={() => setEncodeOpen(false)} />}
      {walkInSlip && <WalkInSlipDialog slip={walkInSlip} onClose={() => setWalkInSlip(null)} />}
      {posterOpen && <CheckInPosterDialog open onClose={() => setPosterOpen(false)} />}

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`flex items-center justify-between rounded-md border p-3 text-sm ${
            feedback.type === "success"
              ? "border-navy-line bg-navy-soft text-navy"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
            className="ml-4 min-h-11 min-w-11 font-bold text-slate-600 hover:text-slate-900 focus-ring md:min-h-8 md:min-w-8"
          >
            ×
          </button>
        </div>
      )}

      <div role="group" aria-label="Applications view" className="flex gap-2">
        {(
          [
            { id: "applications", label: "Applications" },
            { id: "check-ins", label: checkInCount > 0 ? `Check-ins (${checkInCount})` : "Check-ins" },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={view === tab.id ? "primary" : "outline"}
            aria-pressed={view === tab.id}
            className="min-h-11 md:min-h-9"
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Self check-ins are not applications until a recruiter confirms them, so say where they wait. */}
      {view === "applications" && checkInCount > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p>
            {checkInCount === 1 ? "1 applicant is" : `${checkInCount} applicants are`} waiting at the desk. Confirm a
            check-in to add it to this list.
          </p>
          <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={() => setView("check-ins")}>
            View check-ins
          </Button>
        </div>
      )}

      {view === "check-ins" ? (
        <div id="applications-view">
          <CheckInsPanel onConfirmed={setWalkInSlip} />
        </div>
      ) : (
      <div id="applications-view" className="space-y-6">
      <div>
        <SearchFilters
          className="mb-0"
          searchPlaceholder="Search candidate, email or job"
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
            updateListUrl({ q: v || undefined, page: undefined });
          }}
          filterValues={filterValues}
          onFilterChange={(k, v) => {
            const nextValues = { ...filterValues };
            if (v) nextValues[k] = v;
            else delete nextValues[k];
            // If changing client, clear selected job if it no longer belongs to that client.
            if (k === "clientId" && nextValues.jobId) {
              const jobBelongs = jobs.some((j: any) => String(j.id) === nextValues.jobId && (!v || j.mrf?.clientId === Number(v)));
              if (!jobBelongs) delete nextValues.jobId;
            }
            setFilterValues(nextValues);
            setPage(1);
            updateListUrl({
              stage: k === "status" ? (v as ApplicationStatus) || undefined : (nextValues.status as ApplicationStatus | undefined),
              clientId: nextValues.clientId ? Number(nextValues.clientId) : undefined,
              jobId: nextValues.jobId ? Number(nextValues.jobId) : undefined,
              source: nextValues.source as ApplicationSourceFilter | undefined,
              page: undefined,
            });
          }}
          layout="stacked"
          trailing={
              <div className="w-full sm:w-48">
                <label htmlFor="applications-sort" className="sr-only">Sort by</label>
                <ComboBox
                  id="applications-sort"
                  size="sm"
                  placeholder="Sort by"
                  value={sort ?? "match"}
                  options={SORT_OPTIONS}
                  clearable={false}
                  onChange={(v) => {
                    const next = v === "newest" || v === "oldest" || v === "waiting" ? v : undefined;
                    setSort(next);
                    setPage(1);
                    updateListUrl({ sort: next, page: undefined });
                  }}
                />
              </div>
          }
          actions={
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button
                variant={needsAction ? "primary" : "outline"}
                size="sm"
                aria-pressed={needsAction}
                onClick={() => {
                  const next = !needsAction;
                  setNeedsAction(next);
                  setPage(1);
                  updateListUrl({ needsAction: next || undefined, page: undefined });
                }}
              >
                Needs action
              </Button>
              <Button
                variant={returningOnly ? "primary" : "outline"}
                size="sm"
                aria-pressed={returningOnly}
                onClick={() => {
                  const next = !returningOnly;
                  setReturningOnly(next);
                  setPage(1);
                  updateListUrl({ returning: next || undefined, page: undefined });
                }}
              >
                Returning workers only
              </Button>
              <Button
                variant={showArchived ? "primary" : "outline"}
                size="sm"
                aria-pressed={showArchived}
                onClick={() => {
                  const nextArchived = !showArchived;
                  setShowArchived(nextArchived);
                  setPage(1);
                  updateListUrl({ archived: nextArchived || undefined, page: undefined });
                }}
              >
                {showArchived ? "View active" : "View archived"}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="ml-auto text-rose-700 hover:text-rose-900">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear filters ({activeFilterCount})
                </Button>
              )}
            </div>
          }
          filters={[
            {
              key: "clientId",
              label: "Client account",
              placeholder: "All client accounts",
              searchable: true,
              options: availableClients.map((c) => ({
                value: String(c.id),
                label: c.name,
                subtitle: `${c.industry || "General"} • ${[c.address, c.barangay, c.city, c.province, c.postalCode].filter(Boolean).join(", ") || "Philippines"}`,
              })),
            },
            {
              key: "jobId",
              label: "Job opening",
              placeholder: "All job openings",
              searchable: true,
              options: filteredJobs.map((j) => ({
                value: String(j.id),
                label: j.title,
                subtitle: `Reference ${j.id} • ${j.location || "Philippines"}`,
              })),
            },
            {
              key: "source",
              label: "Source",
              placeholder: "All sources",
              options: (["ONLINE", "WALK_IN"] as const).map((value) => ({
                value,
                label: APPLICATION_SOURCE_LABELS[value],
              })),
            },
          ]}
        />
      </div>

      {!showArchived && (
        <StageStrip
          ariaLabel="Application stage"
          items={stageStripItems}
          value={filterValues.status ?? ""}
          onChange={changeStage}
        />
      )}

      {showArchived && (
        <p role="status" className="border border-navy-line bg-navy-soft px-3 py-2 text-sm font-medium text-navy">
          Viewing archived applications. Restore a record to return it to the pipeline.
        </p>
      )}

      <BulkActionBar
        count={selectedRows.length}
        onClear={selection.clear}
        note={totalItems > applications.length ? `on this page (${totalItems} in the list)` : undefined}
        emptyHint="No action fits this mix. Select open records to reject, closed ones to archive, or archived ones to restore."
      >
        {bulkActions.length > 0 &&
          bulkActions.map(({ action, label, variant }) => (
            <Button key={action} size="sm" variant={variant} onClick={() => setBulkAction(action)}>
              {label}
            </Button>
          ))}
      </BulkActionBar>

      {applicationsQuery.isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : applicationsQuery.isError ? (
        <div className="space-y-3">
          <ErrorState
            subject="applications"
            error={applicationsQuery.error}
            onRetry={() => applicationsQuery.refetch()}
          />
          {hasActiveFilters && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      ) : (
        <DataTable
          caption="Applications"
          columns={columns}
          rows={applications}
          getRowId={(app) => String(app.id)}
          renderCard={renderCard}
          isFetching={applicationsQuery.isFetching}
          selection={{
            selectedIds: selection.selectedIds,
            onChange: selection.setSelectedIds,
            rowLabel: (app) => `Select ${candidateNameOf(app)}`,
            // No bulk action applies to a deployed worker, so select all skips them.
            isRowSelectable: (app) => Boolean(app.isArchived) || app.status !== ApplicationStatus.DEPLOYED,
          }}
          empty={
            <EmptyState
              bare
              title={
                showArchived
                  ? "No archived applications"
                  : onlyNeedsActionActive
                  ? "No applications need action"
                  : hasActiveFilters
                  ? "No applications match"
                  : "No applications yet"
              }
              description={
                onlyNeedsActionActive
                  ? "Nothing is waiting on you right now."
                  : hasActiveFilters
                  ? "Change or clear the filters to see more records."
                  : showArchived
                  ? undefined
                  : "Applications submitted through the applicant portal appear here."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : showArchived ? undefined : (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/ta/jobs">Open job openings</Link>
                  </Button>
                )
              }
            />
          }
          footer={
            <Pagination
              variant="inset"
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
                updateListUrl({ page: undefined });
              }}
              onPageChange={(nextPage) => {
                setPage(nextPage);
                updateListUrl({ page: nextPage > 1 ? nextPage : undefined });
              }}
              itemLabel="applications"
            />
          }
        />
      )}
      </div>
      )}

      <BulkApplicationsDialog
        action={bulkAction}
        count={selectedRows.length}
        loading={bulkMutation.isPending}
        onClose={() => setBulkAction(null)}
        onSubmit={(data) =>
          bulkAction &&
          bulkMutation.mutate({ action: bulkAction, ids: selectedRows.map((app) => app.id), data })
        }
      />
      <BulkResultDialog
        open={Boolean(bulkResult)}
        onClose={() => setBulkResult(null)}
        title={bulkResult?.title ?? ""}
        summary={bulkResult?.summary ?? null}
        labelFor={bulkLabelFor}
      />

      {/* Archive / Restore Modal */}
      <Dialog
        open={Boolean(archiveModalApp)}
        onClose={() => setArchiveModalApp(null)}
        title={archiveModalApp?.isArchived ? "Restore Application" : "Archive Application"}
        description={`Record administrative reason to ${archiveModalApp?.isArchived ? "restore" : "archive"} ${archiveModalApp?.name}'s application`}
      >
        <div className="space-y-4">
          <Textarea
            label="Reason for this change"
            placeholder={
              archiveModalApp?.isArchived
                ? "e.g. Candidate recontacted and available for consideration"
                : "e.g. Position filled, candidate unresponsive, or withdrew application"
            }
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            rows={3}
            required
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setArchiveModalApp(null)}>
              Cancel
            </Button>
            <Button
              variant={archiveModalApp?.isArchived ? "primary" : "danger"}
              size="sm"
              disabled={!archiveReason.trim()}
              loading={archiveMutation.isPending || restoreMutation.isPending}
              onClick={() => {
                if (!archiveModalApp) return;
                if (archiveModalApp.isArchived) {
                  restoreMutation.mutate({ id: archiveModalApp.id, reason: archiveReason });
                } else {
                  archiveMutation.mutate({ id: archiveModalApp.id, reason: archiveReason });
                }
              }}
            >
              {archiveModalApp?.isArchived ? "Restore Application" : "Archive Application"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
