import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  StatusBadge,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import {
  Briefcase,
  Plus,
  ArrowRight,
  Building2,
} from "lucide-react";
import { TA_COPY, formatTaStatus } from "../../lib/ta-copy";

export const MRFListPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<string>("priority");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const mrfsQuery = useQuery({
    queryKey: ["ta", "mrfs", filterValues, sortBy],
    queryFn: () =>
      taApi.listMRFs({
        status: filterValues.status || undefined,
        priority: filterValues.priority || undefined,
        clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
        sortBy,
      }),
  });

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
  });

  const allMrfs = mrfsQuery.data || [];
  const clients = clientsQuery.data || [];

  const filteredMrfs = allMrfs.filter((mrf) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const titleMatch = mrf.title.toLowerCase().includes(q);
    const clientMatch = mrf.client?.name?.toLowerCase().includes(q);
    return titleMatch || clientMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMrfs.length / pageSize));
  const paginatedMrfs = filteredMrfs.slice((page - 1) * pageSize, page * pageSize);

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
    setSortBy("priority");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={TA_COPY.navigation.manpowerRequests}
        description="Track client staffing requests, positions to fill, and required documents."
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.manpowerRequests },
        ]}
        actions={
          <Link to="/ta/mrfs/create">
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              New manpower request
            </Button>
          </Link>
        }
      />

      {/* Filter Bar */}
      <SearchFilters
        searchPlaceholder="Search requests by title or client name..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Request status",
            placeholder: "All request statuses",
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
            placeholder: "All client accounts",
            searchable: true,
            options: clients.map((c) => ({
              value: String(c.id),
              label: c.name,
              subtitle: `${c.industry || "General"} • ${c.address || "Philippines"}`,
            })),
          },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="mrf-sort-select" className="text-xs text-slate-600 font-medium shrink-0">
              Sort by:
            </label>
            <select
              id="mrf-sort-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="min-h-11 md:min-h-10 px-3 py-2 text-sm border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-1 focus:border-teal-700 transition-colors cursor-pointer"
            >
              <option value="priority">Priority (Urgent & High first)</option>
              <option value="created_desc">Newest created</option>
              <option value="created_asc">Oldest created</option>
              <option value="target_date">Target fill date (soonest)</option>
            </select>
          </div>
        }
      />

      {/* MRF List */}
      {mrfsQuery.isLoading ? (
        <LoadingState variant="table" rows={5} />
      ) : mrfsQuery.isError ? (
        <ErrorState error={mrfsQuery.error} onRetry={() => mrfsQuery.refetch()} />
      ) : filteredMrfs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <EmptyState
            icon={<Briefcase className="w-6 h-6" />}
            title="No manpower requests found"
            description="Create a request for client staffing needs or reset your filters."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedMrfs.map((mrf) => (
              <div
                key={mrf.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {mrf.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{mrf.client?.name || "Client Account"}</span>
                      </div>
                    </div>
                    <StatusBadge status={formatTaStatus(mrf.status)} type="raw" size="sm" />
                  </div>

                  {(() => {
                    const deployed = mrf.fulfillment?.deployedCount ?? mrf._count?.deployments ?? 0;
                    const calculatedRate =
                      mrf.headcount > 0 ? Math.round((deployed / mrf.headcount) * 100) : 0;
                    const rate = mrf.fulfillment?.fulfillmentRate ?? calculatedRate;
                    const clampedRate = Math.min(100, Math.max(0, rate));
                    const barColor =
                      clampedRate >= 100
                        ? "bg-emerald-600"
                        : clampedRate > 0
                        ? "bg-teal-600"
                        : "bg-slate-300";

                    return (
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between">
                          <span className="text-xs text-slate-500 block">Positions filled</span>
                          <span className="font-bold text-slate-900 truncate block my-0.5">
                            {deployed} / {mrf.headcount} positions
                          </span>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${clampedRate}%` }}
                            />
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center flex flex-col justify-between">
                          <span className="text-xs text-slate-500 block">Priority</span>
                          <StatusBadge status={mrf.priority} type="priority" size="sm" appearance="text" />
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center flex flex-col justify-between">
                          <span className="text-xs text-slate-500 block">Target date</span>
                          <StatusBadge
                            status={mrf.targetFillDate ? formatDate(mrf.targetFillDate) : undefined}
                            type="targetDate"
                            size="sm"
                            appearance="text"
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-500">
                    Request #{mrf.id} • {mrf._count?.jobPostings || 0} job openings
                  </span>
                  <Link
                    to="/ta/mrfs/$mrfId"
                    params={{ mrfId: String(mrf.id) }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      View request
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="bg-white border border-slate-300 p-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredMrfs.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
};
