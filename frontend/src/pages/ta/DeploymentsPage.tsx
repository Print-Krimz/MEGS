import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ActionMenuItem,
  DataTable,
  DataTableColumn,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { cn, formatDate, getDeploymentStatusMeta } from "../../lib/utils";
import { DeploymentStatus, ALLOWED_DEPLOYMENT_TRANSITIONS } from "../../lib/types/enums";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { EndAssignmentDialog } from "../../components/ta/EndAssignmentDialog";
import { RecordCheckInDialog } from "../../components/ta/RecordCheckInDialog";
import { checkInDue } from "../../components/ta/check-in-due";
import { getManilaToday } from "../../lib/field-limits";
import { SERVER_SEARCH_DEBOUNCE_MS, normalizeServerSearch } from "../../lib/query-policies";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

export const DeploymentsPage: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));

  const [statusModalDeployment, setStatusModalDeployment] = useState<{ id: number; currentStatus: DeploymentStatus } | null>(null);
  const [newStatus, setNewStatus] = useState<DeploymentStatus>(DeploymentStatus.ACTIVE);
  const [statusNotes, setStatusNotes] = useState("");
  const [actualStart, setActualStart] = useState(getManilaToday());
  const [endModalDeployment, setEndModalDeployment] = useState<{ id: number; employeeName: string } | null>(null);
  const [reviewModalDeployment, setReviewModalDeployment] = useState<{ id: number; employeeName: string } | null>(null);

  const deploymentsQuery = useQuery({
    queryKey: ["ta", "deployments", "page", { page, pageSize, search: debouncedSearch, filters: filterValues }],
    queryFn: ({ signal }) =>
      taApi.listDeploymentsPage({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        status: filterValues.status || undefined,
        clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
      }, { signal }),
    placeholderData: keepPreviousData,
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

  const clients = clientsQuery.data || [];

  const paginatedDeployments = deploymentsQuery.data?.items ?? [];
  const totalItems = deploymentsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, deploymentsQuery.data?.totalPages ?? 1);

  // A refresh can leave the current page past the end (for example after an assignment ends).
  useEffect(() => {
    if (deploymentsQuery.data && !deploymentsQuery.isPlaceholderData && page > totalPages) setPage(totalPages);
  }, [deploymentsQuery.data, deploymentsQuery.isPlaceholderData, page, totalPages]);

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

  type DeploymentRow = (typeof paginatedDeployments)[0];

  const employeeNameOf = (dep: DeploymentRow) => {
    const profile = dep.employee?.user?.applicantProfile;
    return profile ? `${profile.firstName} ${profile.lastName}` : dep.employee?.employeeNumber || "Employee";
  };

  const detailHref = (dep: DeploymentRow) => `/ta/deployments/${dep.id}`;

  const openConfirmStart = (dep: DeploymentRow) => {
    setStatusModalDeployment({ id: dep.id, currentStatus: dep.status });
    setNewStatus(DeploymentStatus.ACTIVE);
    const defaultStart =
      dep.contractStart && dep.contractStart.slice(0, 10) >= getManilaToday()
        ? dep.contractStart.slice(0, 10)
        : getManilaToday();
    setActualStart(defaultStart);
  };

  const renderRowActions = (dep: DeploymentRow, employeeName: string, fullWidth = false) => {
    const isReady = dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT;
    const isActive = dep.status === DeploymentStatus.ACTIVE;
    const isRedeployable =
      dep.status === DeploymentStatus.ENDED &&
      dep.employee?.status === "AVAILABLE_FOR_REDEPLOYMENT";
    const empId = dep.employee?.id;
    const clientId = dep.client?.id;

    const menuItems: ActionMenuItem[] = [
      {
        label: "View details",
        onSelect: () =>
          navigate({
            to: "/ta/deployments/$deploymentId",
            params: { deploymentId: String(dep.id) },
          }),
      },
    ];

    if (isRedeployable) {
      menuItems.push({
        label: "View in redeployment queue",
        onSelect: () => navigate({ to: "/ta/workforce", search: { tab: "redeployment" } }),
      });
    }

    if (empId) {
      menuItems.push({
        label: "View employee record",
        onSelect: () =>
          navigate({
            to: "/ta/employees/$employeeId",
            params: { employeeId: String(empId) },
          }),
      });
    }

    if (clientId) {
      menuItems.push({
        label: "View client account",
        onSelect: () =>
          navigate({
            to: "/ta/clients/$clientId",
            params: { clientId: String(clientId) },
          }),
      });
    }

    if (isActive) {
      menuItems.push({
        label: "End assignment",
        tone: "danger",
        onSelect: () => setEndModalDeployment({ id: dep.id, employeeName }),
      });
    }

    return (
      <div className={cn("flex items-center gap-2", fullWidth ? "w-full" : "justify-end")}>
        {isReady && (
          <Button variant="outline" size="sm" className={fullWidth ? "flex-1" : undefined} onClick={() => openConfirmStart(dep)}>
            Confirm start
          </Button>
        )}
        {isActive && (
          <Button
            variant="outline"
            size="sm"
            className={fullWidth ? "flex-1" : undefined}
            onClick={() => setReviewModalDeployment({ id: dep.id, employeeName })}
          >
            Record check-in
          </Button>
        )}
        <ActionMenu label={`More actions for ${employeeName}`} items={menuItems} />
      </div>
    );
  };

  const renderCheckIn = (dep: DeploymentRow) => {
    if (dep.status !== DeploymentStatus.ACTIVE) return <span className="text-slate-600">Not applicable</span>;
    const due = checkInDue(dep.nextReviewAt);
    return (
      <span className={cn("text-sm", due.overdue ? "font-semibold text-rose-700" : dep.nextReviewAt ? "text-slate-800" : "text-slate-600")}>
        {due.label}
      </span>
    );
  };

  const planned = (dep: DeploymentRow) =>
    `${dep.contractStart ? formatDate(dep.contractStart) : "Open"} to ${dep.contractEnd ? formatDate(dep.contractEnd) : "open"}`;
  const actual = (dep: DeploymentRow) =>
    dep.actualStart
      ? `${formatDate(dep.actualStart)} to ${dep.actualEnd ? formatDate(dep.actualEnd) : dep.status === DeploymentStatus.ACTIVE ? "now" : "open"}`
      : null;

  const columns: DataTableColumn<DeploymentRow>[] = [
    {
      key: "employee",
      header: "Employee",
      primary: true,
      cell: (dep) => employeeNameOf(dep),
    },
    {
      key: "client",
      header: "Client",
      cell: (dep) =>
        dep.client?.id ? (
          <Link
            to="/ta/clients/$clientId"
            params={{ clientId: String(dep.client.id) }}
            className="focus-ring text-slate-800 underline-offset-2 hover:underline"
          >
            {dep.client.name}
          </Link>
        ) : (
          dep.client?.name || "Not recorded"
        ),
    },
    { key: "site", header: "Site", hideBelow: "lg", cell: (dep) => dep.site || "Client site" },
    {
      key: "status",
      header: "Status",
      cell: (dep) => <StatusBadge status={dep.status} employeeStatus={dep.employee?.status} type="deployment" />,
    },
    {
      key: "dates",
      header: "Dates",
      hideBelow: "lg",
      cell: (dep) => (
        <div className="space-y-0.5 text-xs text-slate-700">
          <div>Planned: {planned(dep)}</div>
          {actual(dep) && <div>Actual: {actual(dep)}</div>}
        </div>
      ),
    },
    { key: "checkin", header: "Check-in", cell: renderCheckIn },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      className: "whitespace-nowrap",
      cell: (dep) => renderRowActions(dep, employeeNameOf(dep)),
    },
  ];

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <PageHeader
          title={TA_COPY.pageTitles.deployments}
          description="Monitor employee assignments, client sites, and contract dates."
          breadcrumbs={[
            { label: TA_COPY.navigation.overview, href: "/ta" },
            { label: TA_COPY.navigation.workforce },
          ]}
          flush
        />
      )}

      <SearchFilters
        searchLabel="Search deployments"
        searchPlaceholder="Search employee, client, or site"
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: DeploymentStatus.READY_FOR_DEPLOYMENT, label: TA_COPY.deployment.readyToStart },
              { value: DeploymentStatus.ACTIVE, label: TA_COPY.deployment.active },
              { value: DeploymentStatus.ENDED, label: TA_COPY.deployment.ended },
              { value: "ENDED_REDEPLOYMENT", label: TA_COPY.deployment.endedWantsAssignment },
              { value: "ENDED_SEPARATED", label: TA_COPY.deployment.endedLeftAgency },
              { value: DeploymentStatus.CANCELLED, label: TA_COPY.deployment.cancelled },
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

      {deploymentsQuery.isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : deploymentsQuery.isError ? (
        <ErrorState error={deploymentsQuery.error} onRetry={() => deploymentsQuery.refetch()} />
      ) : (
        <DataTable
          caption="Deployments"
          columns={columns}
          rows={paginatedDeployments}
          getRowId={(dep) => String(dep.id)}
          rowHref={detailHref}
          cardsBelow="md"
          isFetching={deploymentsQuery.isFetching}
          empty={
            <EmptyState
              bare
              title="No deployments found"
              description="Employees assigned to client sites will appear here after deployment is activated."
              action={
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reset filters
                </Button>
              }
            />
          }
          renderCard={(dep) => {
            const employeeName = employeeNameOf(dep);
            const actualText = actual(dep);
            return (
              <article className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/ta/deployments/$deploymentId"
                      params={{ deploymentId: String(dep.id) }}
                      className="focus-ring inline-flex min-h-11 items-center font-semibold text-navy underline-offset-2 hover:underline"
                    >
                      {employeeName}
                    </Link>
                    <p className="text-sm text-slate-600 break-words">{dep.client?.name || "Client not recorded"}</p>
                  </div>
                  <StatusBadge status={dep.status} employeeStatus={dep.employee?.status} type="deployment" size="sm" />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-600">Site</dt>
                    <dd className="mt-0.5 break-words text-slate-800">{dep.site || "Client site"}</dd>
                  </div>
                  {dep.status === DeploymentStatus.ACTIVE && (
                    <div>
                      <dt className="text-xs text-slate-600">Check-in</dt>
                      <dd className="mt-0.5">{renderCheckIn(dep)}</dd>
                    </div>
                  )}
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-600">Dates</dt>
                    <dd className="mt-0.5 text-slate-800">
                      Planned: {planned(dep)}
                      {actualText && <span className="block">Actual: {actualText}</span>}
                    </dd>
                  </div>
                </dl>
                <div className="border-t border-slate-200 pt-3">{renderRowActions(dep, employeeName, true)}</div>
              </article>
            );
          }}
          footer={
            <Pagination
              variant="inset"
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              itemLabel="deployments"
            />
          }
        />
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
            <div className="p-3 bg-slate-50 border border-slate-200 text-sm flex items-center justify-between">
              <span className="text-slate-600 font-medium">Current status</span>
              <StatusBadge status={statusModalDeployment.currentStatus} type="deployment" />
            </div>
          )}
          {newStatus === DeploymentStatus.ACTIVE ? (
            <Input
              label="Actual first working date"
              type="date"
              value={actualStart}
              min={getManilaToday()}
              onChange={(event) => setActualStart(event.target.value)}
              helperText={actualStart ? `${formatDate(actualStart)}. Must be today or a future date.` : "Must be today or a future date."}
              required
            />
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
              disabled={newStatus === DeploymentStatus.ACTIVE && (!actualStart || actualStart < getManilaToday())}
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

      <RecordCheckInDialog
        open={Boolean(reviewModalDeployment)}
        deploymentId={reviewModalDeployment?.id ?? 0}
        employeeName={reviewModalDeployment?.employeeName ?? ""}
        onClose={() => setReviewModalDeployment(null)}
      />

      <EndAssignmentDialog
        open={Boolean(endModalDeployment)}
        deploymentId={endModalDeployment?.id ?? 0}
        employeeName={endModalDeployment?.employeeName ?? ""}
        onClose={() => setEndModalDeployment(null)}
      />
    </div>
  );
};

