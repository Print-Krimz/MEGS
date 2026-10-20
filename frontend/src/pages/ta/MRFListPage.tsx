import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  StatusBadge,
  DataTable,
} from "../../components/common";
import type { DataTableColumn } from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate, cn } from "../../lib/utils";
import { Plus } from "lucide-react";
import { TA_COPY } from "../../lib/ta-copy";
import { REFERENCE_QUERY_STALE_TIME_MS, SERVER_SEARCH_DEBOUNCE_MS, normalizeServerSearch } from "../../lib/query-policies";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { plural } from "../../lib/plural";

type MrfRow = any;

/** A request is overdue when its target date has passed and it is still being worked. */
function isOverdue(mrf: MrfRow): boolean {
  if (!mrf.targetFillDate || mrf.status === "FILLED" || mrf.status === "CANCELLED") return false;
  const date = new Date(mrf.targetFillDate);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

const TargetDate: React.FC<{ mrf: MrfRow }> = ({ mrf }) => {
  if (!mrf.targetFillDate) return <span className="text-slate-600">No target date</span>;
  const overdue = isOverdue(mrf);
  return (
    <span className={cn(overdue ? "font-medium text-rose-700" : "text-slate-800")}>
      {formatDate(mrf.targetFillDate)}
      {overdue && <span className="block text-xs font-semibold">Overdue</span>}
    </span>
  );
};

const FilledCell: React.FC<{ mrf: MrfRow }> = ({ mrf }) => {
  const deployed = mrf.fulfillment?.deployedCount ?? mrf._count?.deployments ?? 0;
  const calculatedRate = mrf.headcount > 0 ? Math.round((deployed / mrf.headcount) * 100) : 0;
  const rate = mrf.fulfillment?.fulfillmentRate ?? calculatedRate;
  const clampedRate = Math.min(100, Math.max(0, rate));
  return (
    <span className="block min-w-24">
      <span className="block whitespace-nowrap font-medium text-slate-900">
        {deployed} / {mrf.headcount} filled
      </span>
      <span className="mt-1 block h-1.5 w-full overflow-hidden bg-slate-200" aria-hidden="true">
        <span
          className={cn("block h-full", clampedRate >= 100 ? "bg-emerald-700" : "bg-navy")}
          style={{ width: `${clampedRate}%` }}
        />
      </span>
    </span>
  );
};

export const MRFListPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<string>("created_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));

  const mrfsQuery = useQuery({
    queryKey: ["ta", "mrfs", "page", { page, pageSize, search: debouncedSearch, filters: filterValues, sortBy }],
    queryFn: ({ signal }) =>
      taApi.listMRFsPage({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        status: filterValues.status || undefined,
        priority: filterValues.priority || undefined,
        clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
        sortBy,
      }, { signal }),
    placeholderData: keepPreviousData,
  });

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const clients = clientsQuery.data || [];

  const paginatedMrfs = mrfsQuery.data?.items ?? [];
  const totalItems = mrfsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, mrfsQuery.data?.totalPages ?? 1);

  // A refresh can leave the current page past the end (for example after records move out of view).
  useEffect(() => {
    if (mrfsQuery.data && !mrfsQuery.isPlaceholderData && page > totalPages) setPage(totalPages);
  }, [mrfsQuery.data, mrfsQuery.isPlaceholderData, page, totalPages]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (k: string, v: string) => {
    setFilterValues((prev) => ({ ...prev, [k]: v }));
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setFilterValues({});
    setSortBy("created_desc");
    setPage(1);
  };

  const hasFilters = Boolean(debouncedSearch || filterValues.status || filterValues.priority || filterValues.clientId);

  const columns: DataTableColumn<MrfRow>[] = [
    { key: "title", header: "Request", primary: true, cell: (mrf) => mrf.title },
    { key: "client", header: "Client", cell: (mrf) => mrf.client?.name || "Client account" },
    { key: "status", header: "Status", cell: (mrf) => <StatusBadge status={mrf.status} type="raw" size="sm" /> },
    {
      key: "priority",
      header: "Priority",
      cell: (mrf) => <StatusBadge status={mrf.priority} type="priority" size="sm" appearance="text" />,
    },
    { key: "filled", header: "Filled", cell: (mrf) => <FilledCell mrf={mrf} /> },
    { key: "target", header: "Target date", cell: (mrf) => <TargetDate mrf={mrf} /> },
    { key: "jobs", header: "Job openings", align: "right", cell: (mrf) => mrf._count?.jobPostings || 0 },
  ];

  const renderCard = (mrf: MrfRow) => (
    <div className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/ta/mrfs/$mrfId"
          params={{ mrfId: String(mrf.id) }}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline-offset-2 hover:underline focus-ring"
        >
          {mrf.title}
        </Link>
        <StatusBadge status={mrf.status} type="raw" size="sm" />
      </div>
      <p className="text-sm text-slate-600">{mrf.client?.name || "Client account"}</p>
      <FilledCell mrf={mrf} />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-slate-700">
        <span>
          Priority <StatusBadge status={mrf.priority} type="priority" size="sm" appearance="text" />
        </span>
        <span>
          Target <TargetDate mrf={mrf} />
        </span>
        <span>{plural(mrf._count?.jobPostings || 0, "job opening")}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        flush
        title={TA_COPY.pageTitles.manpowerRequests}
        description="Track client staffing requests (MRFs), positions to fill, and required documents."
        breadcrumbs={[
          { label: TA_COPY.breadcrumbRoot, href: "/ta" },
          { label: TA_COPY.navigation.manpowerRequests },
        ]}
        actions={
          <Button asChild variant="primary" size="sm">
            <Link to="/ta/mrfs/create">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New manpower request
            </Link>
          </Button>
        }
      />

      <div className="space-y-3">
        <SearchFilters
          className="!mb-0"
          searchLabel="Search requests"
          searchPlaceholder="Search by title or client"
          searchValue={search}
          onSearchChange={handleSearchChange}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          onReset={handleReset}
          filters={[
            {
              key: "status",
              label: "Request status",
              placeholder: "All statuses",
              options: [
                { value: "OPEN", label: "Open" },
                { value: "IN_PROGRESS", label: "In progress" },
                { value: "FILLED", label: "Filled" },
                { value: "ON_HOLD", label: "On hold" },
                { value: "CANCELLED", label: "Cancelled" },
              ],
            },
            {
              key: "priority",
              label: "Priority",
              placeholder: "All priorities",
              options: [
                { value: "URGENT", label: "Urgent" },
                { value: "HIGH", label: "High" },
                { value: "NORMAL", label: "Normal" },
                { value: "LOW", label: "Low" },
              ],
            },
            {
              key: "clientId",
              label: "Client",
              placeholder: "All clients",
              searchable: true,
              options: clients.map((c) => ({
                value: String(c.id),
                label: c.name,
                subtitle: `${c.industry || "General"} • ${c.address || "Philippines"}`,
              })),
            },
          ]}
        />

        {!mrfsQuery.isLoading && !mrfsQuery.isError && totalItems > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>{plural(totalItems, "request")}</span>
            <div className="flex items-center gap-2">
              <label htmlFor="mrf-sort-select" className="shrink-0 font-medium">
                Sort by
              </label>
              <select
                id="mrf-sort-select"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="min-h-11 cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-ring md:min-h-9"
              >
                <option value="priority">Priority (urgent and high first)</option>
                <option value="created_desc">Newest created</option>
                <option value="created_asc">Oldest created</option>
                <option value="target_date">Target date (soonest)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {mrfsQuery.isLoading ? (
        <LoadingState variant="table" rows={5} />
      ) : mrfsQuery.isError ? (
        <ErrorState subject="manpower requests" error={mrfsQuery.error} onRetry={() => mrfsQuery.refetch()} />
      ) : (
        <DataTable
          caption="Manpower requests"
          columns={columns}
          rows={paginatedMrfs}
          getRowId={(mrf) => String(mrf.id)}
          renderCard={renderCard}
          cardsBelow="lg"
          rowHref={(mrf) => `/ta/mrfs/${mrf.id}`}
          isFetching={mrfsQuery.isFetching}
          empty={
            hasFilters || totalItems > 0 ? (
              <EmptyState
                bare
                title="No manpower requests match these filters"
                description="Try a different search or reset the filters."
                action={
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                bare
                title="No manpower requests yet"
                description="Create a request when a client needs staff."
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link to="/ta/mrfs/create">Create manpower request</Link>
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
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              onPageChange={setPage}
              itemLabel="requests"
            />
          }
        />
      )}
    </div>
  );
};
