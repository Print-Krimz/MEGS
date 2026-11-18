import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  FilterTile,
  FilterTileRow,
  SearchFilters,
  BulkActionBar,
  BulkResultDialog,
  SelectBox,
} from "../../components/common";
import { Button, Dialog } from "../../components/ui";
import { TA_COPY } from "../../lib/ta-copy";
import { employeesApi, type RedeploymentStage } from "../../lib/api/employees.api";
import { taApi } from "../../lib/api/ta.api";
import { cn } from "../../lib/utils";
import { REFERENCE_QUERY_STALE_TIME_MS, SERVER_SEARCH_DEBOUNCE_MS, normalizeServerSearch } from "../../lib/query-policies";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useBulkInvite } from "../../hooks/useBulkInvite";
import { useRowSelection } from "../../hooks/useRowSelection";
import { BulkInviteDialog } from "../../components/ta/BulkInviteDialog";
import { NoAccountChip } from "../../components/ta/walk-in/NoAccountChip";
import { PoolSelectAll } from "../../components/ta/PoolSelectAll";
import { PersonCell, StatusWithAge } from "../../components/ta/workforce/WorkforceRow";
import { RedeploymentDetail, StageChip } from "../../components/ta/workforce/RedeploymentDetail";
import { SmartPlacementDialog } from "../../components/ta/workforce/SmartPlacementDialog";
import {
  REDEPLOYMENT_STAGES as STAGES,
  waitingAge,
  type RedeploymentRow,
} from "../../components/ta/workforce/redeployment-helpers";

type Row = RedeploymentRow;

const PAGE_SIZE = 10;
const WIDE_QUERY = "(min-width: 1280px)";

/** True from 1280px, where the detail pane sits beside the list. Below it a row opens a drill-down. */
const useWideLayout = (): boolean => {
  const read = () =>
    typeof window === "undefined"
      ? false
      : typeof window.matchMedia === "function"
        ? window.matchMedia(WIDE_QUERY).matches
        : window.innerWidth >= 1280;
  const [wide, setWide] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return wide;
};

export const RedeploymentQueuePage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<RedeploymentStage | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<Row | null>(null);
  const [initialJobId, setInitialJobId] = useState<number | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drillOpen, setDrillOpen] = useState(false);
  const wide = useWideLayout();

  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));

  // The server filters, orders, and pages the queue, and returns stage counts for the whole queue.
  const query = useQuery({
    queryKey: ["ta", "redeployment-queue", "page", { page, stage: stageFilter, search: debouncedSearch }],
    queryFn: ({ signal }) =>
      employeesApi.getRedeploymentQueuePage({ page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined, stage: stageFilter }, { signal }),
    placeholderData: keepPreviousData,
  });

  const pageItems = query.data?.items ?? [];
  const totalItems = query.data?.total ?? 0;
  const totalPages = Math.max(1, query.data?.totalPages ?? 1);
  const visibleEmployeeIds = pageItems.map((row) => row.id);

  // Separate request: scores only the workers on this page, so it stays small as the queue grows.
  const suggestionsQuery = useQuery({
    queryKey: ["ta", "redeployment-suggestions", { employeeIds: visibleEmployeeIds.join(",") }],
    queryFn: ({ signal }) => employeesApi.getRedeploymentSuggestions(visibleEmployeeIds, { signal }),
    enabled: visibleEmployeeIds.length > 0 && !query.isPlaceholderData,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Bulk invite: workers who still need a placement can be invited to one job together.
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  const selection = useRowSelection(JSON.stringify([page, stageFilter, debouncedSearch]));
  const bulkInvite = useBulkInvite((sentIds) => {
    const profileIds = new Set(sentIds);
    selection.remove(pageItems.filter((row) => row.applicantProfileId && profileIds.has(row.applicantProfileId)).map((row) => String(row.id)));
    setBulkInviteOpen(false);
  });

  // Open jobs for bulk invite are only needed once bulk invite opens.
  const openJobsQuery = useQuery({
    queryKey: ["ta", "redeployment-open-jobs"],
    queryFn: () => taApi.listJobs({ status: "OPEN" }),
    enabled: bulkInviteOpen,
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  // A refresh can leave the current page past the end (for example after an assignment is sent).
  useEffect(() => {
    if (query.data && !query.isPlaceholderData && page > totalPages) setPage(totalPages);
  }, [query.data, query.isPlaceholderData, page, totalPages]);

  const openAssignment = (row: Row, jobId?: number) => {
    setAssignmentTarget(row);
    setInitialJobId(jobId);
  };

  const closeAssignment = () => {
    setAssignmentTarget(null);
    setInitialJobId(undefined);
  };

  const counts: Record<RedeploymentStage, number> = query.data?.summary.stages ?? { NEEDS_PLACEMENT: 0, WAITING_FOR_REPLY: 0, IN_PROGRESS: 0 };

  const selectedRow = pageItems.find((row) => row.id === selectedId) ?? pageItems[0] ?? null;

  // Only workers who need a placement and have an applicant account can be invited in bulk.
  const canInvite = (row: Row) => row.stage === "NEEDS_PLACEMENT" && Boolean(row.applicantProfileId);
  const invitableRows = pageItems.filter(canInvite);
  const selectedInvitable = invitableRows.filter((row) => selection.selectedIds.has(String(row.id)));
  const toggleAllInvitable = () =>
    selection.setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of invitableRows) {
        if (selectedInvitable.length === invitableRows.length) next.delete(String(row.id));
        else next.add(String(row.id));
      }
      return next;
    });
  const toggleRow = (id: string) =>
    selection.setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rowAction = (row: Row, fullWidth = false) =>
    row.stage === "IN_PROGRESS" ? (
      row.applications[0] ? (
        <Button asChild variant="outline" size="sm" className={fullWidth ? "w-full" : undefined}>
          <Link to="/ta/applications/$applicationId" params={{ applicationId: String(row.applications[0].id) }}>
            Open application
            <span className="sr-only"> for {row.name}</span>
          </Link>
        </Button>
      ) : null
    ) : (
      <Button
        variant={row.stage === "NEEDS_PLACEMENT" && selectedRow?.id === row.id ? "primary" : "outline"}
        size="sm"
        className={fullWidth ? "w-full" : undefined}
        onClick={() => openAssignment(row)}
      >
        {TA_COPY.workforce.actions.findJob}
        <span className="sr-only"> for {row.name}</span>
      </Button>
    );

  const selectRow = (row: Row) => {
    setSelectedId(row.id);
    if (!wide) setDrillOpen(true);
  };

  const detailFor = (row: Row) => (
    <RedeploymentDetail
      row={row}
      suggestions={suggestionsQuery.data?.items[row.id]}
      suggestionsLoading={suggestionsQuery.isPending}
      suggestionsFailed={suggestionsQuery.isError}
      onRetrySuggestions={() => suggestionsQuery.refetch()}
      onFindJob={(jobId) => {
        setDrillOpen(false);
        openAssignment(row, jobId);
      }}
    />
  );

  const hasActiveFilters = Boolean(stageFilter || search.trim());
  const emptyState = (
    <EmptyState
      bare
      title={hasActiveFilters ? "No workers match this view" : "No workers waiting for redeployment"}
      description={
        hasActiveFilters
          ? "Clear the search or the selected group to see everyone in the queue."
          : "Workers who confirm they want another assignment will appear here after their previous placement ends."
      }
      action={
        hasActiveFilters ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setStageFilter(null);
              setPage(1);
            }}
          >
            Reset filters
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="space-y-4">
      <FilterTileRow columns={3}>
        {STAGES.map((stage) => {
          const active = stageFilter === stage.id;
          return (
            <FilterTile
              key={stage.id}
              label={stage.label}
              value={counts[stage.id]}
              hint={active ? "Showing only this group. Select again to clear." : stage.hint}
              tone={stage.id === "NEEDS_PLACEMENT" && counts[stage.id] > 0 ? "warning" : "neutral"}
              selected={active}
              ariaLabel={`${stage.label}: ${counts[stage.id]}`}
              onClick={() => {
                setStageFilter(active ? null : stage.id);
                setPage(1);
              }}
            />
          );
        })}
      </FilterTileRow>
      <SearchFilters
        searchLabel="Search redeployment queue"
        searchPlaceholder="Search employee, previous client, or role"
        searchValue={search}
        hasActiveExternalFilters={stageFilter !== null}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onReset={() => {
          setSearch("");
          setStageFilter(null);
          setPage(1);
        }}
      />
      <BulkActionBar count={selectedInvitable.length} onClear={selection.clear}>
        <Button size="sm" onClick={() => setBulkInviteOpen(true)}>
          Invite to a job
        </Button>
      </BulkActionBar>
      {query.isLoading ? (
        <LoadingState variant="table" rows={5} />
      ) : query.isError ? (
        <ErrorState subject="the redeployment queue" error={query.error} onRetry={() => query.refetch()} />
      ) : (
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section
          aria-label="Redeployment queue"
          aria-busy={query.isFetching}
          className="overflow-hidden rounded-md border border-slate-300 bg-white"
        >
          {pageItems.length === 0 ? (
            emptyState
          ) : (
            <>
            {invitableRows.length > 0 && (
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-1">
                <PoolSelectAll
                  total={invitableRows.length}
                  selected={selectedInvitable.length}
                  onToggle={toggleAllInvitable}
                  noun="workers"
                />
              </div>
            )}
            <ul className="divide-y divide-slate-200">
              {pageItems.map((row) => {
                const selected = wide && selectedRow?.id === row.id;
                const wait = waitingAge(row.waitingSince);
                return (
                  <li
                    key={row.id}
                    className={cn(
                      "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center",
                      selected ? "bg-navy-soft shadow-[inset_3px_0_0_var(--color-navy)]" : "hover:bg-slate-50",
                    )}
                  >
                    {invitableRows.length > 0 && (
                      <SelectBox
                        checked={selection.selectedIds.has(String(row.id))}
                        disabled={!canInvite(row)}
                        label={`Select ${row.name}`}
                        onChange={() => toggleRow(String(row.id))}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => selectRow(row)}
                      aria-current={selected ? "true" : undefined}
                      className="focus-ring flex min-h-11 min-w-0 flex-1 flex-col items-start gap-2 rounded-md text-left text-slate-950 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <PersonCell
                        name={row.name}
                        context={[row.previousRole, row.previousClient]}
                        badge={<NoAccountChip hasPortalAccess={row.hasPortalAccess} />}
                      />
                      <div className="sm:w-52 sm:shrink-0">
                        <StatusWithAge chip={<StageChip stage={row.stage} />} age={wait.text} ageTone={wait.tone} />
                      </div>
                    </button>
                    <div className="shrink-0 sm:w-36 sm:text-right [&>*]:w-full">{rowAction(row)}</div>
                  </li>
                );
              })}
            </ul>
            </>
          )}
          {totalItems > PAGE_SIZE && (
            <div className="border-t border-slate-300">
              <Pagination
                variant="inset"
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                itemLabel="workers"
              />
            </div>
          )}
        </section>
        {wide && selectedRow && (
          <aside
            aria-label={`${selectedRow.name} redeployment details`}
            className="sticky top-4 rounded-md border border-slate-300 bg-white p-5"
          >
            {detailFor(selectedRow)}
          </aside>
        )}
      </div>
      )}
      <BulkInviteDialog
        open={bulkInviteOpen}
        onClose={() => setBulkInviteOpen(false)}
        count={selectedInvitable.length}
        jobs={openJobsQuery.data ?? []}
        draftMessage={(jobTitle) =>
          `We have ${jobTitle ? `an open ${jobTitle} role` : "an open role"} that fits your experience. Please review the role and accept it in your Applicant account.`
        }
        loading={bulkInvite.mutation.isPending}
        onSubmit={(payload) =>
          bulkInvite.mutation.mutate({
            ...payload,
            applicantProfileIds: selectedInvitable.map((row) => row.applicantProfileId!),
          })
        }
      />
      <BulkResultDialog
        open={Boolean(bulkInvite.failures)}
        onClose={bulkInvite.clearFailures}
        title="Invite to a job"
        summary={bulkInvite.failures}
        labelFor={(id) => pageItems.find((row) => row.applicantProfileId === id)?.name ?? `Worker ${id}`}
      />
      <Dialog
        open={drillOpen && !wide && Boolean(selectedRow)}
        onClose={() => setDrillOpen(false)}
        title="Redeployment details"
        size="lg"
      >
        {selectedRow && detailFor(selectedRow)}
      </Dialog>
      <SmartPlacementDialog
        open={Boolean(assignmentTarget)}
        onClose={closeAssignment}
        initialJobId={initialJobId}
        suggestions={assignmentTarget ? suggestionsQuery.data?.items[assignmentTarget.id] : undefined}
        target={
          assignmentTarget
            ? {
                employeeId: assignmentTarget.id,
                name: assignmentTarget.name,
                applicantProfileId: assignmentTarget.applicantProfileId,
                hasPortalAccess: assignmentTarget.hasPortalAccess,
                hasMobile: assignmentTarget.hasMobile,
                maskedMobile: assignmentTarget.maskedMobile,
                previousClient: assignmentTarget.previousClient,
                previousRole: assignmentTarget.previousRole,
                waitingSince: assignmentTarget.waitingSince,
                pastClients: assignmentTarget.pastClients,
              }
            : null
        }
      />
    </div>
  );
};
