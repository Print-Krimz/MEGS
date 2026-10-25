import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  BulkActionBar,
  BulkResultDialog,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { cn, formatDate, getDeploymentStatusMeta } from "../../lib/utils";
import { DeploymentStatus, ALLOWED_DEPLOYMENT_TRANSITIONS } from "../../lib/types/enums";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { EndAssignmentDialog } from "../../components/ta/EndAssignmentDialog";
import { RecordCheckInDialog } from "../../components/ta/RecordCheckInDialog";
import { checkInDue } from "../../components/ta/check-in-due";
import { PersonCell, StatusWithAge, WorkforceCard } from "../../components/ta/workforce/WorkforceRow";
import { getManilaToday } from "../../lib/field-limits";
import { SERVER_SEARCH_DEBOUNCE_MS, normalizeServerSearch } from "../../lib/query-policies";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useRowSelection } from "../../hooks/useRowSelection";
import {
  BulkDeploymentDialog,
  type BulkDeploymentAction,
  type BulkDeploymentSubmission,
} from "../../components/ta/BulkDeploymentDialog";
import { BulkEndAssignmentDialog, type BulkEndSubmission } from "../../components/ta/BulkEndAssignmentDialog";
import type { BulkSummary } from "../../lib/types/application.types";

export const DeploymentsPage: React.FC<{ hideHeader?: boolean; initialSearch?: string }> = ({ hideHeader = false, initialSearch = "" }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(initialSearch);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));

  const [statusModalDeployment, setStatusModalDeployment] = useState<{ id: number; currentStatus: DeploymentStatus } | null>(null);
  const [newStatus, setNewStatus] = useState<DeploymentStatus>(DeploymentStatus.ACTIVE);
  const [statusNotes, setStatusNotes] = useState("");
  const [actualStart, setActualStart] = useState(getManilaToday());
  const [endModalDeployment, setEndModalDeployment] = useState<{ id: number; employeeName: string; actualStart?: string | null } | null>(null);
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

  type DeploymentRow = (typeof paginatedDeployments)[0];

  const employeeNameOf = (dep: DeploymentRow) => {
    const profile = dep.employee?.user?.applicantProfile;
    return profile ? `${profile.firstName} ${profile.lastName}` : dep.employee?.employeeNumber || "Employee";
  };

  // The first working date for a worker: their own contract start unless it has already passed.
  const ownStartDate = (dep: DeploymentRow) =>
    dep.contractStart && dep.contractStart.slice(0, 10) >= getManilaToday() ? dep.contractStart.slice(0, 10) : getManilaToday();

  // Bulk actions. Selection is dropped whenever the visible list changes.
  const selection = useRowSelection(JSON.stringify([page, pageSize, debouncedSearch, filterValues]));
  const selectedRows = paginatedDeployments.filter((dep) => selection.selectedIds.has(String(dep.id)));
  const [bulkAction, setBulkAction] = useState<BulkDeploymentAction | null>(null);
  const [bulkResult, setBulkResult] = useState<{ title: string; summary: BulkSummary; names: Record<number, string> } | null>(null);
  const canBulkStart = selectedRows.length > 0 && selectedRows.every((dep) => dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT);
  const canBulkCheckIn = selectedRows.length > 0 && selectedRows.every((dep) => dep.status === DeploymentStatus.ACTIVE);

  const bulkMutation = useMutation({
    mutationFn: ({ action, rows, data }: { action: BulkDeploymentAction; rows: DeploymentRow[]; data: BulkDeploymentSubmission }) =>
      action === "start"
        ? taApi.bulkConfirmDeploymentStart({
            items: rows.map((dep) => ({ id: dep.id, actualStart: data.startMode === "same" ? data.date : ownStartDate(dep) })),
            notes: data.notes,
          })
        : taApi.bulkRecordDeploymentCheckIns({ ids: rows.map((dep) => dep.id), nextReviewAt: data.date, notes: data.notes }),
    onSuccess: (summary, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "deployment"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      selection.remove(summary.results.filter((row) => row.ok).map((row) => String(row.id)));
      setBulkAction(null);
      const title = vars.action === "start" ? "Confirm site start" : "Record check-in";
      if (summary.failed > 0) {
        setBulkResult({ title, summary, names: Object.fromEntries(vars.rows.map((dep) => [dep.id, employeeNameOf(dep)])) });
      } else {
        notify.success(title, `${summary.succeeded} ${summary.succeeded === 1 ? "deployment" : "deployments"} updated.`);
      }
    },
    onError: (err: any) => notify.error("Unable to complete the bulk action", err),
  });

  // Ending several assignments at once: one date, reason and next step for everyone selected.
  const [bulkEndOpen, setBulkEndOpen] = useState(false);
  const bulkEndMutation = useMutation({
    mutationFn: ({ rows, data }: { rows: DeploymentRow[]; data: BulkEndSubmission }) =>
      taApi.bulkEndDeployments({ ids: rows.map((dep) => dep.id), ...data }),
    onSuccess: (summary, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      selection.remove(summary.results.filter((row) => row.ok).map((row) => String(row.id)));
      setBulkEndOpen(false);
      if (summary.failed > 0) {
        setBulkResult({
          title: "End assignments",
          summary,
          names: Object.fromEntries(vars.rows.map((dep) => [dep.id, employeeNameOf(dep)])),
        });
      } else {
        notify.success("Assignments ended", `${summary.succeeded} ${summary.succeeded === 1 ? "assignment was" : "assignments were"} ended.`);
      }
    },
    onError: (err: any) => notify.error("Unable to end the assignments", err),
  });

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

  const detailHref = (dep: DeploymentRow) => `/ta/deployments/${dep.id}`;

  const openConfirmStart = (dep: DeploymentRow) => {
    setStatusModalDeployment({ id: dep.id, currentStatus: dep.status });
    setNewStatus(DeploymentStatus.ACTIVE);
    setActualStart(ownStartDate(dep));
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
        onSelect: () => setEndModalDeployment({ id: dep.id, employeeName, actualStart: dep.actualStart }),
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

  /** The line under the status chip: what is due next for this assignment. */
  const ageOf = (dep: DeploymentRow): { text: string; tone: "normal" | "urgent" | "warning" } | null => {
    if (dep.status === DeploymentStatus.ACTIVE) {
      const due = checkInDue(dep.nextReviewAt);
      const text = `Check-in ${due.label.charAt(0).toLowerCase()}${due.label.slice(1)}`;
      return { text, tone: due.overdue ? "urgent" : "normal" };
    }
    if (dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT) {
      return { text: dep.contractStart ? `Starts ${formatDate(dep.contractStart)}` : "Start date not set", tone: "normal" };
    }
    if (dep.status === DeploymentStatus.ENDED && dep.actualEnd) {
      return { text: `Ended ${formatDate(dep.actualEnd)}`, tone: "normal" };
    }
    return null;
  };

  const statusCell = (dep: DeploymentRow) => {
    const age = ageOf(dep);
    return (
      <StatusWithAge
        chip={<StatusBadge status={dep.status} employeeStatus={dep.employee?.status} type="deployment" size="sm" />}
        age={age?.text}
        ageTone={age?.tone}
      />
    );
  };

  const contract = (dep: DeploymentRow) =>
    `${dep.contractStart ? formatDate(dep.contractStart) : "Open"} to ${dep.contractEnd ? formatDate(dep.contractEnd) : "open"}`;

  const columns: DataTableColumn<DeploymentRow>[] = [
    {
      key: "employee",
      header: "Employee",
      primary: true,
      cell: (dep) => <PersonCell name={employeeNameOf(dep)} context={[dep.client?.name || "Client not recorded", dep.site || "Client site"]} />,
    },
    { key: "status", header: "Status", cell: statusCell },
    { key: "dates", header: "Contract", hideBelow: "lg", cell: (dep) => <span className="text-xs text-slate-700">{contract(dep)}</span> },
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
            searchable: true,
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

      <BulkActionBar
        count={selectedRows.length}
        onClear={selection.clear}
        emptyHint="Select deployments that are all ready to start, or all active."
      >
        {canBulkStart && (
          <Button size="sm" onClick={() => setBulkAction("start")}>
            Confirm start
          </Button>
        )}
        {canBulkCheckIn && (
          <Button size="sm" onClick={() => setBulkAction("checkin")}>
            Record check-in
          </Button>
        )}
        {canBulkCheckIn && (
          <Button size="sm" variant="outline" onClick={() => setBulkEndOpen(true)}>
            End assignment
          </Button>
        )}
      </BulkActionBar>

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
          density="compact"
          isFetching={deploymentsQuery.isFetching}
          selection={{
            selectedIds: selection.selectedIds,
            onChange: selection.setSelectedIds,
            rowLabel: (dep) => `Select ${employeeNameOf(dep)}`,
            isRowSelectable: (dep) =>
              dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT || dep.status === DeploymentStatus.ACTIVE,
          }}
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
            return (
              <WorkforceCard
                href={detailHref(dep)}
                name={employeeName}
                context={[dep.client?.name || "Client not recorded", dep.site || "Client site"]}
                status={statusCell(dep)}
                details={<span className="text-xs text-slate-600">Contract {contract(dep)}</span>}
                action={renderRowActions(dep, employeeName, true)}
              />
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

      <BulkDeploymentDialog
        action={bulkAction}
        count={selectedRows.length}
        loading={bulkMutation.isPending}
        onClose={() => setBulkAction(null)}
        onSubmit={(data) => bulkAction && bulkMutation.mutate({ action: bulkAction, rows: selectedRows, data })}
      />
      <BulkEndAssignmentDialog
        open={bulkEndOpen}
        workers={selectedRows.map((dep) => ({ id: dep.id, name: employeeNameOf(dep), actualStart: dep.actualStart }))}
        loading={bulkEndMutation.isPending}
        onClose={() => setBulkEndOpen(false)}
        onSubmit={(data) => bulkEndMutation.mutate({ rows: selectedRows, data })}
      />
      <BulkResultDialog
        open={Boolean(bulkResult)}
        onClose={() => setBulkResult(null)}
        title={bulkResult?.title ?? ""}
        summary={bulkResult?.summary ?? null}
        labelFor={(id) => bulkResult?.names[id] ?? `Deployment ${id}`}
      />

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
        actualStart={endModalDeployment?.actualStart}
        onClose={() => setEndModalDeployment(null)}
      />
    </div>
  );
};

