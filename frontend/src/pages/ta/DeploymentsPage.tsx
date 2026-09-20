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
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";

export const DeploymentsPage: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
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
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      setStatusModalDeployment(null);
      setStatusNotes("");
      notify.success("Deployment Status Updated", `Deployment moved to ${getDeploymentStatusMeta(vars.status).label}.`);
    },
    onError: (err: any) => {
      notify.error("Unable to update deployment status", err);
    },
  });

  const allDeployments = deploymentsQuery.data || [];
  const clients = clientsQuery.data || [];

  const filteredDeployments = allDeployments.filter((dep) => {
    if (!search || !search.trim()) return true;
    const q = search.trim().toLowerCase();
    const emp = dep.employee;
    const profile = emp?.user?.applicantProfile || dep.application?.user?.applicantProfile;
    const empName = profile
      ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim().toLowerCase()
      : "";
    const empEmail = (emp?.user?.email || dep.application?.user?.email || "").toLowerCase();
    const siteMatch = (dep.site || "").toLowerCase().includes(q);
    const clientMatch = (dep.client?.name || "").toLowerCase().includes(q);
    const empNumMatch = (emp?.employeeNumber || "").toLowerCase().includes(q);
    const jobTitleMatch = (dep.application?.jobPosting?.title || dep.mrf?.title || "").toLowerCase().includes(q);
    return empName.includes(q) || empEmail.includes(q) || siteMatch || clientMatch || empNumMatch || jobTitleMatch;
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
      {!hideHeader && (
        <PageHeader
          title="Site deployments"
          description="Monitor employee assignments, client sites, and contract dates."
          breadcrumbs={[
            { label: TA_COPY.navigation.overview, href: "/ta" },
            { label: TA_COPY.navigation.workforce },
          ]}
        />
      )}

      {/* Filters Bar */}
      <SearchFilters
        searchPlaceholder="Search employee, employee number, client, or site..."
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
            label: "Client account",
            placeholder: "All client accounts",
            searchable: true,
            options: clients.map((c) => ({
              value: String(c.id),
              label: c.name,
              subtitle: `${c.industry || "General"} • ${c.address || "Philippines"}`,
            })),
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
            title="No site deployments found"
            description="Employees assigned to client sites will appear here after deployment is activated."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="md:hidden divide-y divide-slate-200">
            {paginatedDeployments.map((dep) => {
              const profile = dep.employee?.user?.applicantProfile;
              const employeeName = profile
                ? `${profile.firstName} ${profile.lastName}`
                : dep.employee?.employeeNumber || "Employee";
              const allowedNext = ALLOWED_DEPLOYMENT_TRANSITIONS[dep.status] || [];
              return (
                <article key={dep.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-slate-950 break-words">{employeeName}</h4>
                      <p className="mt-0.5 text-sm text-slate-600 break-words">{dep.client?.name || "Client not recorded"}</p>
                    </div>
                    <StatusBadge status={dep.status} type="deployment" size="sm" />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-slate-500">Site</dt><dd className="mt-0.5 text-slate-800 break-words">{dep.site || "Client site"}</dd></div>
                    <div><dt className="text-slate-500">Contract</dt><dd className="mt-0.5 text-slate-800">{dep.contractStart ? formatDate(dep.contractStart) : "Not set"}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                    {allowedNext.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStatusModalDeployment({ id: dep.id, currentStatus: dep.status });
                          setNewStatus(allowedNext[0]);
                        }}
                      >
                        Update status
                      </Button>
                    )}
                    <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(dep.id) }}>
                      <Button variant="primary" size="sm">View details</Button>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Site</th>
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
                        {emp?.id ? (
                          <Link
                            to="/ta/employees/$employeeId"
                            params={{ employeeId: String(emp.id) }}
                            className="font-bold text-slate-900 hover:text-teal-700 hover:underline block"
                          >
                            {empName}
                          </Link>
                        ) : (
                          <div className="font-bold text-slate-900">{empName}</div>
                        )}
                        <div className="text-[11px] text-slate-400 font-mono">
                          Employee no.: {emp?.employeeNumber || "Not recorded"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {dep.client?.id ? (
                          <Link
                            to="/ta/clients/$clientId"
                            params={{ clientId: String(dep.client.id) }}
                            className="font-semibold text-slate-800 hover:text-teal-700 hover:underline block"
                          >
                            {dep.client.name}
                          </Link>
                        ) : (
                          <div className="font-semibold text-slate-800">{dep.client?.name}</div>
                        )}
                        <div className="text-[11px] text-slate-400 font-mono">
                          Request #{dep.mrfId || "Direct"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {dep.site || "General Client Site"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={dep.status} type="deployment" />
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
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
                              Update status
                            </Button>
                          )}
                          <Link
                            to="/ta/deployments/$deploymentId"
                            params={{ deploymentId: String(dep.id) }}
                          >
                            <Button variant="outline" size="sm">
                            View details
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
              itemLabel="deployments"
            />
          </div>
        </div>
      )}

      {/* Update Deployment Status Modal */}
      <Dialog
        open={Boolean(statusModalDeployment)}
        onClose={() => setStatusModalDeployment(null)}
        title="Update Deployment Status"
            description="Update the employee’s current site assignment status."
      >
        <div className="space-y-4">
          {statusModalDeployment && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
              <span className="text-slate-500 font-medium">Current status</span>
              <StatusBadge status={statusModalDeployment.currentStatus} type="deployment" />
            </div>
          )}
          <Select
            label="New status"
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
            label="Notes (optional)"
            placeholder="Add a reason or note for this change..."
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
              Save status
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

