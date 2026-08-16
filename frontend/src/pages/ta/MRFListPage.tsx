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
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import {
  Briefcase,
  Plus,
  ArrowRight,
  Building2,
} from "lucide-react";

export const MRFListPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const mrfsQuery = useQuery({
    queryKey: ["ta", "mrfs", filterValues],
    queryFn: () =>
      taApi.listMRFs({
        status: filterValues.status || undefined,
        clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
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
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manpower Requests (MRF)"
        description="Client labor requisition orders, target headcount fulfillment, and compliance templates"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Manpower Requests" },
        ]}
        actions={
          <Link to="/ta/mrfs/create">
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              New Manpower Request
            </Button>
          </Link>
        }
      />

      {/* Filter Bar */}
      <SearchFilters
        searchPlaceholder="Search MRF by title or client name..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Request Status",
            options: [
              { value: "OPEN", label: "OPEN" },
              { value: "IN_PROGRESS", label: "IN PROGRESS" },
              { value: "FILLED", label: "FILLED" },
              { value: "ON_HOLD", label: "ON HOLD" },
              { value: "CANCELLED", label: "CANCELLED" },
            ],
          },
          {
            key: "clientId",
            label: "Client Account",
            options: clients.map((c) => ({ value: String(c.id), label: c.name })),
          },
        ]}
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
            title="No Manpower Requests Found"
            description="Create a client labor requisition order or reset your filters."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset Filters
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
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                        mrf.status === "OPEN"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : mrf.status === "FILLED"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {mrf.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center">
                      <span className="text-[10px] text-slate-400 uppercase block">Headcount</span>
                      <span className="font-bold text-slate-900">{mrf.headcount} pax</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center">
                      <span className="text-[10px] text-slate-400 uppercase block">Priority</span>
                      <span className={`font-bold ${mrf.priority === "URGENT" ? "text-rose-600" : "text-slate-800"}`}>
                        {mrf.priority}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center">
                      <span className="text-[10px] text-slate-400 uppercase block">Target Date</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {mrf.targetFillDate ? formatDate(mrf.targetFillDate) : "ASAP"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-500">
                    MRF #{mrf.id} • {mrf._count?.jobPostings || 0} Requisitions
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
                      View MRF Details
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
