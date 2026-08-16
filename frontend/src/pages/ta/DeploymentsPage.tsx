import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  StatusBadge,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { formatDate, getDeploymentStatusMeta } from "../../lib/utils";
import { DeploymentStatus, ALLOWED_DEPLOYMENT_TRANSITIONS } from "../../lib/types/enums";
import {
  Truck,
} from "lucide-react";

export const DeploymentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [statusModalDeployment, setStatusModalDeployment] = useState<{ id: number; currentStatus: DeploymentStatus } | null>(null);
  const [newStatus, setNewStatus] = useState<DeploymentStatus>(DeploymentStatus.ACTIVE);
  const [statusNotes, setStatusNotes] = useState("");

  const deploymentsQuery = useQuery({
    queryKey: ["ta", "deployments", filterValues],
    queryFn: () =>
      taApi.listDeployments({
        status: filterValues.status || undefined,
        clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
      }),
  });

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: DeploymentStatus; notes?: string }) =>
      taApi.updateDeploymentStatus(id, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      setStatusModalDeployment(null);
      setStatusNotes("");
    },
  });

  const allDeployments = deploymentsQuery.data || [];
  const clients = clientsQuery.data || [];

  const filteredDeployments = allDeployments.filter((dep) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const emp = dep.employee;
    const profile = emp?.user?.applicantProfile;
    const empName = profile
      ? `${profile.firstName} ${profile.lastName}`.toLowerCase()
      : (emp?.employeeNumber || "").toLowerCase();
    const siteMatch = (dep.site || "").toLowerCase().includes(q);
    const clientMatch = (dep.client?.name || "").toLowerCase().includes(q);
    const empNumMatch = (emp?.employeeNumber || "").toLowerCase().includes(q);
    return empName.includes(q) || siteMatch || clientMatch || empNumMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredDeployments.length / pageSize));
  const paginatedDeployments = filteredDeployments.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

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
        title="Workforce Site Deployments"
        description="Monitor field site assignments, employee deployments, and active client personnel contracts"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Deployments" },
        ]}
      />

      {/* Filters Bar */}
      <SearchFilters
        searchPlaceholder="Search employee name, number, or site..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Deployment Status",
            options: Object.values(DeploymentStatus).map((s) => ({
              value: s,
              label: getDeploymentStatusMeta(s).label,
            })),
          },
          {
            key: "clientId",
            label: "Client Company",
            options: clients.map((c) => ({ value: String(c.id), label: c.name })),
          },
        ]}
      />

      {/* Deployments Table */}
      {deploymentsQuery.isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : deploymentsQuery.isError ? (
        <ErrorState error={deploymentsQuery.error} onRetry={() => deploymentsQuery.refetch()} />
      ) : filteredDeployments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <EmptyState
            icon={<Truck className="w-6 h-6" />}
            title="No Deployments Found"
            description="Personnel transitioned from hired candidates and assigned to client sites will appear here."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset Filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Assigned Employee</th>
                  <th className="px-4 py-3 font-semibold">Client Company</th>
                  <th className="px-4 py-3 font-semibold">Deployment Site</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Contract Schedule</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDeployments.map((dep) => {
                  const emp = dep.employee;
                  const profile = emp?.user?.applicantProfile;
                  const empName = profile
                    ? `${profile.firstName} ${profile.lastName}`
                    : emp?.employeeNumber || "Employee";
                  const allowedNext = ALLOWED_DEPLOYMENT_TRANSITIONS[dep.status] || [];

                  return (
                    <tr key={dep.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{empName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ID: {emp?.employeeNumber || "N/A"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{dep.client?.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          MRF #{dep.mrfId || "Direct"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {dep.site || "General Client Site"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={dep.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">
                        {dep.contractStart ? formatDate(dep.contractStart) : "N/A"} —{" "}
                        {dep.contractEnd ? formatDate(dep.contractEnd) : "Open"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {allowedNext.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setStatusModalDeployment({ id: dep.id, currentStatus: dep.status });
                                setNewStatus(allowedNext[0]);
                              }}
                            >
                              Update Status
                            </Button>
                          )}
                          <Link
                            to="/ta/deployments/$deploymentId"
                            params={{ deploymentId: String(dep.id) }}
                          >
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredDeployments.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Update Deployment Status Modal */}
      <Dialog
        open={Boolean(statusModalDeployment)}
        onClose={() => setStatusModalDeployment(null)}
        title="Update Deployment Status"
        description="Update the employee's current deployment status."
      >
        <div className="space-y-4">
          {statusModalDeployment && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
              <span className="text-slate-500 font-mono">Current Status:</span>
              <StatusBadge status={statusModalDeployment.currentStatus} />
            </div>
          )}
          <Select
            label="Target Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as DeploymentStatus)}
            options={
              statusModalDeployment
                ? (ALLOWED_DEPLOYMENT_TRANSITIONS[statusModalDeployment.currentStatus] || []).map((s) => ({
                    value: s,
                    label: getDeploymentStatusMeta(s).label,
                  }))
                : []
            }
          />
          <Textarea
            label="Status Notes / Coordinator Remarks"
            placeholder="Document reason or remarks for this status update..."
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setStatusModalDeployment(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={updateStatusMutation.isPending}
              onClick={() => {
                if (statusModalDeployment) {
                  updateStatusMutation.mutate({
                    id: statusModalDeployment.id,
                    status: newStatus,
                    notes: statusNotes || undefined,
                  });
                }
              }}
            >
              Confirm Status
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

