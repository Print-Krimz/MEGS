import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button } from "../../components/ui";
import {
  RotateCcw,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";

export const RevalidationQueuePage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  const queueQuery = useQuery({
    queryKey: ["admin", "scoring", "revalidation"],
    queryFn: adminApi.getRevalidationStatus,
    refetchInterval: 5000, // Poll every 5s for worker telemetry
  });

  const status = queueQuery.data;
  const counts = status?.counts || { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
  const failures = useMemo(() => status?.failures || [], [status?.failures]);

  // Filter failures by search query
  const filteredFailures = useMemo(() => {
    if (!searchQuery.trim()) return failures;
    const query = searchQuery.toLowerCase().trim();
    return failures.filter(
      (f) =>
        f.id.toLowerCase().includes(query) ||
        f.target.toLowerCase().includes(query) ||
        f.lastError.toLowerCase().includes(query)
    );
  }, [failures, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredFailures.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);

  const paginatedFailures = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredFailures.slice(startIndex, startIndex + pageSize);
  }, [filteredFailures, currentPage, pageSize]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setPage(1);
  };

  if (queueQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Candidate Score Reassessment Queue"
          description="Loading assessment status..."
        />
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  if (queueQuery.isError || !queueQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Candidate Score Reassessment Queue"
          description="Score reassessment queue status"
        />
        <ErrorState error={queueQuery.error} onRetry={() => queueQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Score update queue"
        description="Track candidate score recalculations when scoring weights or candidate profiles are updated"
        breadcrumbs={[
          { label: "Admin Operations", href: "/admin" },
          { label: "Score Reassessment Queue" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => queueQuery.refetch()}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Refresh Status
          </Button>
        }
      />

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-300 border border-slate-300 bg-white">
        <div className="p-3.5 bg-white">
          <div className="text-[10px] font-mono font-bold text-amber-800 uppercase tracking-wider">
            Pending in Queue
          </div>
          <div className="text-2xl font-bold font-mono text-amber-950 mt-0.5 tabular-nums">
            {counts.PENDING}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Waiting in queue
          </div>
        </div>

        <div className="p-3.5 bg-white">
          <div className="text-[10px] font-mono font-bold text-blue-800 uppercase tracking-wider">
            Processing Now
          </div>
          <div className="text-2xl font-bold font-mono text-blue-950 mt-0.5 tabular-nums">
            {counts.PROCESSING}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Currently reassessing
          </div>
        </div>

        <div className="p-3.5 bg-white">
          <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
            Completed Reassessments
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5 tabular-nums">
            {counts.COMPLETED}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Up-to-date candidate match scores
          </div>
        </div>

        <div className="p-3.5 bg-white">
          <div className="text-[10px] font-mono font-bold text-rose-800 uppercase tracking-wider">
            Failed Updates
          </div>
          <div className="text-2xl font-bold font-mono text-rose-950 mt-0.5 tabular-nums">
            {counts.FAILED}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Unable to complete update
          </div>
        </div>
      </div>

      {/* Failed Jobs Section */}
      <div className="border border-slate-300 bg-white">
        <div className="p-3 border-b border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              Reassessment Errors & Exceptions {failures.length > 0 && `(${filteredFailures.length})`}
            </h3>
          </div>

          {failures.length > 0 && (
            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by Task ID, target, or error..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                aria-label="Filter errors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  aria-label="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {failures.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="All assessment tasks up to date"
              description="No processing errors or failed score updates detected in the queue."
            />
          </div>
        ) : filteredFailures.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No matching error records"
              description={`No failed reassessment tasks matched "${searchQuery}".`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSearch}
                >
                  Clear Filter
                </Button>
              }
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-mono text-[11px] uppercase border-b border-slate-300">
                  <tr>
                    <th className="px-3.5 py-2.5 font-bold">Task ID</th>
                    <th className="px-3.5 py-2.5 font-bold">Candidate / Application</th>
                    <th className="px-3.5 py-2.5 font-bold text-center">Attempts</th>
                    <th className="px-3.5 py-2.5 font-bold">Error Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {paginatedFailures.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-100/70 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-950">{f.id}</td>
                      <td className="px-3.5 py-2.5 text-slate-700">{f.target}</td>
                      <td className="px-3.5 py-2.5 text-center font-bold text-rose-700">
                        {f.attempts}
                      </td>
                      <td className="px-3.5 py-2.5 text-rose-900 text-[11px] font-sans">
                        {f.lastError}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Component */}
            <div className="p-3 border-t border-slate-300 bg-slate-50">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredFailures.length}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
