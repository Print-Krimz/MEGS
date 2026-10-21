import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
  DataTable,
  type DataTableColumn,
} from "../../components/common";
import { Button, Dialog, Textarea } from "../../components/ui";
import { formatDate, getApplicationStatusMeta } from "../../lib/utils";
import { StageStrip, STAGE_STRIP_STAGES, type StageStripItem } from "../../components/ta/recruitment/StageStrip";
import {
  ApplicationStatus,
  PIPELINE_FILTER_STAGES,
} from "../../lib/types/enums";
import { notify } from "../../lib/feedback";
import type { ReturningWorkerInfo, TAApplicationSummary } from "../../lib/types/application.types";
import type { TAApplicationSearch } from "../../routes";
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
      className={`mt-1 inline-flex max-w-[18rem] items-center rounded border px-1.5 py-0.5 text-xs font-medium ${
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

const candidateNameOf = (app: TAApplicationSummary) => {
  const p = app.user?.applicantProfile;
  const name = p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : "";
  return name || app.user?.email || "Candidate";
};

const isClosedRecord = (app: TAApplicationSummary) =>
  Boolean(app.isArchived) || CLOSED_STATUSES.includes(app.status);

const readApplicationSearch = (): TAApplicationSearch => {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const stage = params.get("stage");
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
  }));
  const [showArchived, setShowArchived] = useState(Boolean(routeSearch.archived));
  const [returningOnly, setReturningOnly] = useState(Boolean(routeSearch.returning));

  useEffect(() => {
    setPage(routeSearch.page || 1);
    setSearch(routeSearch.q || "");
    setFilterValues({
      ...(routeSearch.stage ? { status: routeSearch.stage } : {}),
      ...(routeSearch.clientId ? { clientId: String(routeSearch.clientId) } : {}),
      ...(routeSearch.jobId ? { jobId: String(routeSearch.jobId) } : {}),
    });
    setShowArchived(Boolean(routeSearch.archived));
    setReturningOnly(Boolean(routeSearch.returning));
  }, [routeSearch.page, routeSearch.q, routeSearch.stage, routeSearch.clientId, routeSearch.jobId, routeSearch.archived, routeSearch.returning]);

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
        archived: valueFor("archived", showArchived || undefined),
        returning: valueFor("returning", returningOnly || undefined),
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
    archived: showArchived || undefined,
    returning: returningOnly || undefined,
    page: page > 1 ? page : undefined,
  };

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
      showArchived,
      returningOnly,
    }],
    queryFn: ({ signal }) =>
      taApi.listApplicationsPage({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: (filterValues.status as ApplicationStatus) || undefined,
        jobId: filterValues.jobId ? Number(filterValues.jobId) : undefined,
        clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
        isArchived: showArchived,
        returning: returningOnly || undefined,
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
        returningOnly,
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
            isArchived: false,
            returning: returningOnly || undefined,
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


  const hasActiveFilters = Boolean(search) || returningOnly || Object.keys(filterValues).length > 0;

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
    setPage(1);
    updateListUrl({ returning: undefined, q: undefined, stage: undefined, clientId: undefined, jobId: undefined, page: undefined });
  };

  const openArchiveDialog = (app: TAApplicationSummary) =>
    setArchiveModalApp({ id: app.id, name: candidateNameOf(app), isArchived: Boolean(app.isArchived) });

  const detailLink = (app: TAApplicationSummary, className?: string) => (
    <Link
      to="/ta/applications/$applicationId"
      params={{ applicationId: String(app.id) }}
      search={listSearch}
      className={className ?? "font-medium text-navy underline-offset-2 hover:underline focus-ring"}
    >
      {candidateNameOf(app)}
    </Link>
  );

  const archiveAction = (app: TAApplicationSummary) =>
    isClosedRecord(app) ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => openArchiveDialog(app)}
        aria-label={`${app.isArchived ? "Restore" : "Archive"} application for ${candidateNameOf(app)}`}
      >
        {app.isArchived ? "Restore" : "Archive"}
      </Button>
    ) : null;

  const columns: DataTableColumn<TAApplicationSummary>[] = [
    {
      key: "candidate",
      header: "Candidate",
      primary: true,
      cell: (app) => (
        <div className="min-w-0">
          {detailLink(app)}
          <div className="text-xs text-slate-600">{app.user?.email}</div>
          <ReturningBadge info={app.returning} />
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
    ...(showArchived || applications.some(isClosedRecord)
      ? [
          {
            key: "actions",
            header: "Action",
            align: "right" as const,
            cell: (app: TAApplicationSummary) => archiveAction(app),
          },
        ]
      : []),
  ];

  const renderCard = (app: TAApplicationSummary) => (
    <article className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words">
            {detailLink(app, "inline-flex min-h-11 items-center font-medium text-navy underline-offset-2 hover:underline focus-ring")}
          </h2>
          <p className="mt-0.5 break-words text-sm text-slate-600">
            {app.jobPosting?.title || "Job opening"}
            {app.jobPosting?.mrf?.client?.name ? ` · ${app.jobPosting.mrf.client.name}` : ""}
          </p>
          <ReturningBadge info={app.returning} />
        </div>
        <div className="text-right">
          <StatusBadge status={app.status} />
          <ScreeningSkippedNote info={app.returning} />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
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
      {isClosedRecord(app) && <div className="border-t border-slate-200 pt-3">{archiveAction(app)}</div>}
    </article>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={TA_COPY.pageTitles.applications}
        description="Review applications, see their current stage, and continue the next hiring action."
                breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.applications },
        ]}
        flush
      />

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
              page: undefined,
            });
          }}
          onReset={resetFilters}
          actions={
            <div className="flex flex-wrap items-center gap-2">
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
                Reset filters
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
          empty={
            <EmptyState
              bare
              title={showArchived ? "No archived applications" : hasActiveFilters ? "No applications match" : "No applications yet"}
              description={
                hasActiveFilters
                  ? "Change or clear the filters to see more records."
                  : showArchived
                  ? undefined
                  : "Applications submitted through the applicant portal appear here."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Reset filters
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
