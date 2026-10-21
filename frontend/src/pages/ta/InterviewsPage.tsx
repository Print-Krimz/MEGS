import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  DataTable,
  FilterTile,
  FilterTileRow,
  type DataTableColumn,
  type DataTableSort,
} from "../../components/common";
import { Button } from "../../components/ui";
import { InterviewAgenda, interviewStageLabel } from "../../components/ta/recruitment/InterviewAgenda";
import { cn, formatDate } from "../../lib/utils";
import { formatInterviewDeadlineStatus, TA_COPY } from "../../lib/ta-copy";
import { notify } from "../../lib/feedback";
import { SERVER_SEARCH_DEBOUNCE_MS, normalizeServerSearch } from "../../lib/query-policies";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  InterviewOutcomeDialog,
  interviewOutcomeNextStep,
  interviewOutcomeWord,
  type InterviewOutcomeResult,
} from "../../components/ta/InterviewOutcomeDialog";

type SortField = "candidate" | "position" | "scheduledAt" | "deadline";

type InterviewRow = {
  interviewId: number;
  applicationId: number;
  candidateName: string;
  jobTitle: string;
  currentStage: string;
  scheduledAt: string;
  deadline: string;
  status: string;
};

const statusChipClass = (status: string) =>
  status === "BREACHED"
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : status === "WARNING"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";

const stageLabel = interviewStageLabel;

type InterviewView = "agenda" | "table";
const AGENDA_PAGE_SIZE = 100;

export const InterviewsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const viewParam = (useSearch({ strict: false }) as Record<string, unknown>).view;
  const view: InterviewView = viewParam === "table" ? "table" : "agenda";
  const setView = (next: InterviewView) => {
    setPage(1);
    void navigate({
      to: "/ta/interviews",
      search: ((prev: Record<string, unknown>) => ({ ...prev, view: next === "agenda" ? undefined : next })) as never,
      replace: true,
    });
  };

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  // The server orders by deadline. That puts Overdue first, then Due soon, then On track.
  const [sortField, setSortField] = useState<SortField>("deadline");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = view === "agenda" ? AGENDA_PAGE_SIZE : 8;
  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));

  const [targetInterview, setTargetInterview] = useState<InterviewRow | null>(null);

  const agenda = view === "agenda";
  const slaQuery = useQuery({
    queryKey: ["ta", "compliance", "interviews", "page", { page, pageSize, search: debouncedSearch, status: statusFilter, stage: stageFilter, position: positionFilter, sortField, sortDirection }],
    queryFn: ({ signal }) =>
      taApi.listInterviewCompliancePage({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        stage: stageFilter || undefined,
        position: positionFilter || undefined,
        sortField: agenda ? "deadline" : sortField,
        sortDirection: agenda ? "asc" : sortDirection,
      }, { signal }),
    placeholderData: keepPreviousData,
  });

  const updateResultMutation = useMutation({
    mutationFn: ({
      applicationId,
      interviewId,
      result,
      notes,
    }: {
      applicationId: number;
      interviewId: number;
      result: InterviewOutcomeResult;
      notes?: string;
      isFinalInterview: boolean;
    }) =>
      taApi.updateInterviewStatus(applicationId, interviewId, {
        result,
        conductedAt: new Date().toISOString(),
        notes,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "compliance", "interviews"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", String(vars.applicationId)] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      setTargetInterview(null);
      notify.success(
        "Interview outcome saved",
        `The interview was marked as ${interviewOutcomeWord(vars.result)}. ${interviewOutcomeNextStep(vars.result, vars.isFinalInterview)}`,
      );
    },
    onError: (err: any) => {
      notify.error("Unable to save interview outcome", err);
    },
  });

  const slaData = slaQuery.data;
  const summary = slaData?.summary || { total: 0, breached: 0, warning: 0, healthy: 0 };
  const paginatedItems = (slaData?.items ?? []) as InterviewRow[];
  const totalItems = slaData?.total ?? 0;
  const totalPages = Math.max(1, slaData?.totalPages ?? 1);

  const positionOptions = (slaData?.positions ?? []).map((title) => ({ value: title, label: title }));

  // A refresh can leave the current page past the end (for example after outcomes are recorded).
  useEffect(() => {
    if (slaData && !slaQuery.isPlaceholderData && page > totalPages) setPage(totalPages);
  }, [slaData, slaQuery.isPlaceholderData, page, totalPages]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === "stage") {
      setStageFilter(value);
    } else if (key === "position") {
      setPositionFilter(value);
    }
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setStageFilter("");
    setPositionFilter("");
    setStatusFilter("ALL");
    setPage(1);
  };

  const selectStatus = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSort = ({ key, direction }: DataTableSort) => {
    setSortField(key as SortField);
    setSortDirection(direction);
  };

  const description =
    statusFilter === "BREACHED"
      ? "Overdue: more than 7 days in this stage."
      : statusFilter === "WARNING"
      ? "Due soon: the 7-day deadline is within 48 hours."
      : statusFilter === "HEALTHY"
      ? "On track: within the 7-day deadline."
      : "Record each outcome before the 7-day deadline. Overdue interviews come first.";

  if (slaQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={TA_COPY.pageTitles.interviews} description="Loading interview deadlines..." />
        <LoadingState variant="table" rows={6} />
      </div>
    );
  }

  if (slaQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title={TA_COPY.pageTitles.interviews} description="Interview deadlines" />
        <ErrorState subject="interviews" error={slaQuery.error} onRetry={() => slaQuery.refetch()} />
      </div>
    );
  }

  const emptyState = (
    summary.total === 0 ? (
                  <EmptyState bare title="No interviews waiting for an outcome" />
                ) : (
                  <EmptyState
                    bare
                    title="No matching interviews"
                    description="Change the search, interview type, or job opening filter."
                    action={
                      <Button variant="outline" size="sm" onClick={handleReset}>
                        Reset filters
                      </Button>
                    }
                  />
                )
  );

  const firstOverdueId = paginatedItems.find((row) => row.status === "BREACHED")?.interviewId;
  const recordButton = (row: InterviewRow) => (
    <Button
      variant={row.interviewId === firstOverdueId ? "primary" : "outline"}
      size="sm"
      aria-label={`${TA_COPY.interviews.recordOutcome} for ${row.candidateName}`}
      onClick={() => setTargetInterview(row)}
    >
      {TA_COPY.interviews.recordOutcome}
    </Button>
  );

  const candidateLink = (row: InterviewRow, className = "font-medium text-navy underline-offset-2 hover:underline focus-ring") => (
    <Link
      to="/ta/applications/$applicationId"
      params={{ applicationId: String(row.applicationId) }}
      className={className}
    >
      {row.candidateName}
    </Link>
  );

  const statusChip = (row: InterviewRow) => (
    <span className={`inline-flex whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${statusChipClass(row.status)}`}>
      {formatInterviewDeadlineStatus(row.status)}
    </span>
  );

  const columns: DataTableColumn<InterviewRow>[] = [
    { key: "candidate", header: "Candidate", sortable: true, primary: true, cell: (row) => candidateLink(row) },
    { key: "stage", header: "Interview type", cell: (row) => <span className="text-slate-700">{stageLabel(row.currentStage)}</span> },
    { key: "position", header: "Job opening", sortable: true, cell: (row) => <span className="text-slate-900">{row.jobTitle}</span> },
    { key: "scheduledAt", header: "Scheduled", sortable: true, cell: (row) => <span className="whitespace-nowrap text-slate-700">{formatDate(row.scheduledAt)}</span> },
    { key: "deadline", header: "Deadline", sortable: true, cell: (row) => <span className="whitespace-nowrap text-slate-700">{formatDate(row.deadline)}</span> },
    { key: "status", header: "Status", cell: statusChip },
    { key: "actions", header: "Action", align: "right", cell: recordButton },
  ];

  const renderCard = (row: InterviewRow) => (
    <article className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words">{candidateLink(row, "inline-flex min-h-11 items-center font-medium text-navy underline-offset-2 hover:underline focus-ring")}</h3>
          <p className="mt-0.5 break-words text-sm text-slate-600">{row.jobTitle}</p>
          <p className="text-sm text-slate-600">{stageLabel(row.currentStage)}</p>
        </div>
        {statusChip(row)}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-600">Scheduled</dt><dd className="mt-0.5 whitespace-nowrap text-slate-800">{formatDate(row.scheduledAt)}</dd></div>
        <div><dt className="text-slate-600">Deadline</dt><dd className="mt-0.5 whitespace-nowrap text-slate-800">{formatDate(row.deadline)}</dd></div>
      </dl>
      <div className="border-t border-slate-200 pt-3">{recordButton(row)}</div>
    </article>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={TA_COPY.pageTitles.interviews}
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.interviews },
        ]}
        flush
      />

      <FilterTileRow columns={4}>
        <FilterTile label="All interviews" value={summary.total} hint="Awaiting outcome" selected={statusFilter === "ALL"} onClick={() => selectStatus("ALL")} />
        <FilterTile label="Overdue" value={summary.breached} hint="Immediate action" tone="danger" selected={statusFilter === "BREACHED"} onClick={() => selectStatus("BREACHED")} />
        <FilterTile label="Due soon" value={summary.warning} hint="Within 48 hours" tone="warning" selected={statusFilter === "WARNING"} onClick={() => selectStatus("WARNING")} />
        <FilterTile label="On track" value={summary.healthy} hint="Within the 7-day deadline" selected={statusFilter === "HEALTHY"} onClick={() => selectStatus("HEALTHY")} />
      </FilterTileRow>

      <SearchFilters
        className="mb-0"
        searchPlaceholder="Search candidate name or position title..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={{
          stage: stageFilter,
          position: positionFilter,
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        }}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "stage",
            label: "Interview type",
            placeholder: "All interview types",
            searchable: true,
            options: [
              { value: "INITIAL_SCREENING", label: "Initial screening" },
              { value: "FINAL_INTERVIEW", label: "Final interview" },
            ],
          },
          {
            key: "position",
            label: "Job opening",
            placeholder: "All job openings",
            searchable: true,
            options: positionOptions,
          },
        ]}
      />

      <section aria-labelledby="awaiting-outcome-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="awaiting-outcome-heading" className="text-lg font-semibold text-slate-950">Awaiting outcome</h2>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <div role="group" aria-label="Interview view" className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
            {(["agenda", "table"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={cn(
                  "min-h-11 rounded px-4 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-navy md:min-h-8",
                  view === option ? "bg-navy text-white" : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {option === "agenda" ? "Agenda" : "Table"}
              </button>
            ))}
          </div>
        </div>

        {agenda ? (
          paginatedItems.length === 0 ? (
            <div className="rounded-md border border-slate-300 bg-white">{emptyState}</div>
          ) : (
            <>
              <InterviewAgenda rows={paginatedItems} onRecord={setTargetInterview} />
              {totalItems > paginatedItems.length && (
                <p className="text-sm text-slate-600">
                  Showing the {paginatedItems.length} most urgent of {totalItems} interviews. Narrow the search or switch to Table to see the rest.
                </p>
              )}
            </>
          )
        ) : (
          <DataTable
            caption="Interviews awaiting an outcome"
            columns={columns}
            rows={paginatedItems}
            getRowId={(row) => String(row.interviewId)}
            renderCard={renderCard}
            sort={{ key: sortField, direction: sortDirection }}
            onSortChange={handleSort}
            isFetching={slaQuery.isFetching}
            empty={
              summary.total === 0 ? (
                <EmptyState bare title="No interviews waiting for an outcome" />
              ) : (
                <EmptyState
                  bare
                  title="No matching interviews"
                  description="Change the search, interview type, or job opening filter."
                  action={
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      Reset filters
                    </Button>
                  }
                />
              )
            }
            footer={
              <Pagination
                variant="inset"
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                itemLabel="interviews"
              />
            }
          />
        )}
      </section>

      <InterviewOutcomeDialog
        open={Boolean(targetInterview)}
        onClose={() => setTargetInterview(null)}
        candidateName={targetInterview?.candidateName ?? ""}
        jobTitle={targetInterview?.jobTitle}
        isFinalInterview={targetInterview?.currentStage === "FINAL_INTERVIEW"}
        scheduledAt={targetInterview?.scheduledAt}
        isSubmitting={updateResultMutation.isPending}
        onSubmit={({ result, notes }) => {
          if (!targetInterview) return;
          updateResultMutation.mutate({
            applicationId: targetInterview.applicationId,
            interviewId: targetInterview.interviewId,
            result,
            notes: notes || undefined,
            isFinalInterview: targetInterview.currentStage === "FINAL_INTERVIEW",
          });
        }}
      />
    </div>
  );
};
