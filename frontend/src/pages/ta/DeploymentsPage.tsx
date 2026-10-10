import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
  ActionMenu,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { formatDate, getDeploymentStatusMeta } from "../../lib/utils";
import { DeploymentStatus, ALLOWED_DEPLOYMENT_TRANSITIONS } from "../../lib/types/enums";
import {
  Truck,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { employeesApi } from "../../lib/api/employees.api";
import { getManilaToday } from "../../lib/field-limits";

export const DeploymentsPage: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [attentionFilter, setAttentionFilter] = useState<"ALL" | "STARTS_DUE" | "REVIEWS_DUE">("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [statusModalDeployment, setStatusModalDeployment] = useState<{ id: number; currentStatus: DeploymentStatus } | null>(null);
  const [newStatus, setNewStatus] = useState<DeploymentStatus>(DeploymentStatus.ACTIVE);
  const [statusNotes, setStatusNotes] = useState("");
  const [actualStart, setActualStart] = useState(getManilaToday());
  const [endModalDeployment, setEndModalDeployment] = useState<{ id: number; employeeName: string } | null>(null);
  const [actualEnd, setActualEnd] = useState(getManilaToday());
  const [endReason, setEndReason] = useState("");
  const [endDisposition, setEndDisposition] = useState<"AVAILABLE_FOR_REDEPLOYMENT" | "NOT_CONFIRMED" | "SEPARATED">("NOT_CONFIRMED");
  const [reviewModalDeployment, setReviewModalDeployment] = useState<{ id: number; employeeName: string } | null>(null);
  const [nextReviewAt, setNextReviewAt] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

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
    mutationFn: ({ id, status, notes, actualStart }: { id: number; status: DeploymentStatus; notes?: string; actualStart?: string }) =>
      taApi.updateDeploymentStatus(id, { status, notes, actualStart }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setStatusModalDeployment(null);
      setStatusNotes("");
      notify.success("Deployment Status Updated", `Deployment moved to ${getDeploymentStatusMeta(vars.status).label}.`);
    },
    onError: (err: any) => {
      notify.error("Unable to update deployment status", err);
    },
  });

  const endAssignmentMutation = useMutation({
    mutationFn: () => {
      if (!endModalDeployment) throw new Error("Select an assignment first.");
      return employeesApi.endEmployeeDeployment(endModalDeployment.id, {
        actualEnd,
        reason: endReason.trim(),
        disposition: endDisposition,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEndModalDeployment(null);
      setEndReason("");
      notify.success("Assignment ended", "The actual end date and employee status were recorded.");
    },
    onError: (err: any) => notify.error("Unable to end assignment", err?.message || err),
  });

  const recordReviewMutation = useMutation({
    mutationFn: () => {
      if (!reviewModalDeployment || !nextReviewAt) throw new Error("Choose the next check-in date.");
      return taApi.recordDeploymentReview(reviewModalDeployment.id, { nextReviewAt, notes: reviewNotes.trim() || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      setReviewModalDeployment(null);
      setReviewNotes("");
      notify.success("Check-in recorded", "The next assignment review is scheduled.");
    },
    onError: (error: any) => notify.error("Could not record check-in", error?.message || error),
  });

  const allDeployments = deploymentsQuery.data || [];
  const clients = clientsQuery.data || [];
  const startsDueCount = allDeployments.filter((deployment) =>
    deployment.status === DeploymentStatus.READY_FOR_DEPLOYMENT &&
    deployment.contractStart && deployment.contractStart.slice(0, 10) <= getManilaToday()
  ).length;
  const reviewsDueCount = allDeployments.filter((deployment) =>
    deployment.status === DeploymentStatus.ACTIVE &&
    deployment.nextReviewAt && deployment.nextReviewAt.slice(0, 10) <= getManilaToday()
  ).length;

  const filteredDeployments = allDeployments.filter((dep) => {
    if (attentionFilter === "STARTS_DUE" && !(dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT && dep.contractStart && dep.contractStart.slice(0, 10) <= getManilaToday())) return false;
    if (attentionFilter === "REVIEWS_DUE" && !(dep.status === DeploymentStatus.ACTIVE && dep.nextReviewAt && dep.nextReviewAt.slice(0, 10) <= getManilaToday())) return false;
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

  const renderRowActions = (
    dep: (typeof paginatedDeployments)[0],
    employeeName: string
  ) => {
    if (dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT) {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusModalDeployment({ id: dep.id, currentStatus: dep.status });
              setNewStatus(DeploymentStatus.ACTIVE);
              setActualStart(dep.contractStart?.slice(0, 10) || getManilaToday());
            }}
          >
            Confirm start
          </Button>
          <ActionMenu
            label={`Actions for ${employeeName}`}
            items={[
              {
                label: "View details",
                onSelect: () =>
                  navigate({
                    to: "/ta/deployments/$deploymentId",
                    params: { deploymentId: String(dep.id) },
                  }),
              },
            ]}
          />
        </div>
      );
    }

    if (dep.status === DeploymentStatus.ACTIVE) {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            to="/ta/deployments/$deploymentId"
            params={{ deploymentId: String(dep.id) }}
          >
            <Button variant="outline" size="sm">
              View details
            </Button>
          </Link>
          <ActionMenu
            label={`Actions for ${employeeName}`}
            items={[
              {
                label: "Record check-in",
                onSelect: () => {
                  setReviewModalDeployment({ id: dep.id, employeeName });
                  setNextReviewAt("");
                  setReviewNotes("");
                },
              },
              {
                label: "End assignment",
                tone: "danger",
                onSelect: () => {
                  setEndModalDeployment({ id: dep.id, employeeName });
                  setActualEnd(getManilaToday());
                  setEndReason("");
                  setEndDisposition("NOT_CONFIRMED");
                },
              },
            ]}
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-1.5">
        <Link
          to="/ta/deployments/$deploymentId"
          params={{ deploymentId: String(dep.id) }}
        >
          <Button variant="outline" size="sm">
            View details
          </Button>
        </Link>
      </div>
    );
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

      <div className="flex flex-wrap gap-2" aria-label="Assignment attention filters">
        <Button variant={attentionFilter === "ALL" ? "primary" : "outline"} size="sm" onClick={() => { setAttentionFilter("ALL"); setPage(1); }}>All assignments</Button>
        <Button variant={attentionFilter === "STARTS_DUE" ? "primary" : "outline"} size="sm" onClick={() => { setAttentionFilter("STARTS_DUE"); setPage(1); }}>Start confirmations due ({startsDueCount})</Button>
        <Button variant={attentionFilter === "REVIEWS_DUE" ? "primary" : "outline"} size="sm" onClick={() => { setAttentionFilter("REVIEWS_DUE"); setPage(1); }}>Check-ins due ({reviewsDueCount})</Button>
      </div>

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
                    <div><dt className="text-slate-500">Planned</dt><dd className="mt-0.5 text-slate-800">{dep.contractStart ? formatDate(dep.contractStart) : "Not set"}{dep.contractEnd ? ` – ${formatDate(dep.contractEnd)}` : " – Open"}</dd></div>
                    <div><dt className="text-slate-500">Actual</dt><dd className="mt-0.5 text-slate-800">{dep.actualStart ? formatDate(dep.actualStart) : dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT ? "Not started" : "Start date not recorded"}{dep.actualEnd ? ` – ${formatDate(dep.actualEnd)}` : dep.status === DeploymentStatus.ACTIVE ? " – Ongoing" : dep.status === DeploymentStatus.ENDED ? " – End date not recorded" : ""}</dd></div>
                    {dep.status === DeploymentStatus.ACTIVE && <div><dt className="text-slate-500">Next check-in</dt><dd className="mt-0.5 text-slate-800">{dep.nextReviewAt ? formatDate(dep.nextReviewAt) : "Not scheduled"}</dd></div>}
                  </dl>
                  <div className="border-t border-slate-200 pt-3">
                    {renderRowActions(dep, employeeName)}
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
                  <th className="px-4 py-3 font-semibold">Planned / actual dates</th>
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
                        <div>Planned: {dep.contractStart ? formatDate(dep.contractStart) : "N/A"} — {dep.contractEnd ? formatDate(dep.contractEnd) : "Open"}</div>
                        <div>Actual: {dep.actualStart ? formatDate(dep.actualStart) : dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT ? "Not started" : "Start date not recorded"} — {dep.actualEnd ? formatDate(dep.actualEnd) : dep.status === DeploymentStatus.ACTIVE ? "Ongoing" : dep.status === DeploymentStatus.ENDED ? "End date not recorded" : "—"}</div>
                        {dep.status === DeploymentStatus.ACTIVE && <div>Next check-in: {dep.nextReviewAt ? formatDate(dep.nextReviewAt) : "Not scheduled"}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderRowActions(dep, empName)}
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
        title={newStatus === DeploymentStatus.ACTIVE ? "Confirm site start" : "Update deployment status"}
        description={newStatus === DeploymentStatus.ACTIVE ? "Record the date the employee actually started at the client site." : "Update the scheduled placement status."}
      >
        <div className="space-y-4">
          {statusModalDeployment && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
              <span className="text-slate-500 font-medium">Current status</span>
              <StatusBadge status={statusModalDeployment.currentStatus} type="deployment" />
            </div>
          )}
          {newStatus === DeploymentStatus.ACTIVE ? (
            <Input label="Actual first working date" type="date" value={actualStart} max={getManilaToday()} onChange={(event) => setActualStart(event.target.value)} required />
          ) : <Select
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
          />}
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
                    actualStart: newStatus === DeploymentStatus.ACTIVE ? actualStart : undefined,
                  });
                }
              }}
            >
              {newStatus === DeploymentStatus.ACTIVE ? "Confirm start" : "Save status"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={Boolean(reviewModalDeployment)} onClose={() => setReviewModalDeployment(null)} title="Record assignment check-in" description={reviewModalDeployment ? `Record a check-in for ${reviewModalDeployment.employeeName} and set the next review date.` : undefined}>
        <div className="space-y-4">
          <Input label="Next check-in date" type="date" value={nextReviewAt} min={getManilaToday()} onChange={(event) => setNextReviewAt(event.target.value)} required />
          <Textarea label="Check-in notes (optional)" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} placeholder="Record whether the worker and client expect the assignment to continue." />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" size="sm" onClick={() => setReviewModalDeployment(null)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={!nextReviewAt} loading={recordReviewMutation.isPending} onClick={() => recordReviewMutation.mutate()}>Save check-in</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(endModalDeployment)}
        onClose={() => setEndModalDeployment(null)}
        title="End assignment"
        description={endModalDeployment ? `Record the last working date and next step for ${endModalDeployment.employeeName}.` : undefined}
      >
        <div className="space-y-4">
          <Input label="Actual last working date" type="date" value={actualEnd} max={getManilaToday()} onChange={(event) => setActualEnd(event.target.value)} required />
          <Select
            label="Worker’s next step"
            value={endDisposition}
            onChange={(event) => setEndDisposition(event.target.value as typeof endDisposition)}
            options={[
              { value: "AVAILABLE_FOR_REDEPLOYMENT", label: "Wants another assignment" },
              { value: "NOT_CONFIRMED", label: "Not confirmed yet" },
              { value: "SEPARATED", label: "Leaving the agency" },
            ]}
          />
          <Textarea label="Reason for ending this assignment" value={endReason} onChange={(event) => setEndReason(event.target.value)} rows={3} required placeholder="For example: client assignment ended or worker requested a transfer" />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" size="sm" onClick={() => setEndModalDeployment(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={endAssignmentMutation.isPending} disabled={!actualEnd || !endReason.trim()} onClick={() => endAssignmentMutation.mutate()}>End assignment</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

