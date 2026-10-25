import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { Dialog, Button, Select } from "../ui";
import { LoadingState, ErrorState, EmptyState, Pagination, DataTable, ConfirmDialog, BulkActionBar, BulkResultDialog } from "../common";
import { useRowSelection } from "../../hooks/useRowSelection";
import type { DataTableColumn } from "../common";
import { formatDate, cn } from "../../lib/utils";
import { notify } from "../../lib/feedback";
import { OfferReplyActions } from "./OfferReplyActions";
import { TA_COPY } from "../../lib/ta-copy";
import type { TalentPoolInvitationRecord } from "../../lib/types/ta.types";
import type { BulkSummary } from "../../lib/types/application.types";

export interface InvitationsTrackerDrawerProps {
  open: boolean;
  onClose: () => void;
  jobPostingId?: number;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  ACCEPTED: { label: "Accepted", className: "text-emerald-800" },
  DECLINED: { label: "Declined", className: "text-rose-800" },
  EXPIRED: { label: "Expired", className: "text-slate-700" },
  CANCELLED: { label: "Cancelled", className: "text-slate-700" },
  PENDING: { label: "Pending", className: "text-amber-800" },
};

const CHANNEL_LABELS: Record<string, string> = {
  ASSISTED_PHONE: "Recorded by phone",
  IN_PERSON: "Recorded in person",
  MAGIC_LINK: "Replied by text link",
};

type InvitationRow = TalentPoolInvitationRecord;

export const InvitationsTrackerDrawer: React.FC<InvitationsTrackerDrawerProps> = ({
  open,
  onClose,
  jobPostingId,
}) => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  const invitationsQuery = useQuery({
    queryKey: ["ta", "talent-pool", "invitations", { jobPostingId, statusFilter, page }],
    queryFn: () =>
      taApi.listTalentPoolInvitations({
        jobPostingId: jobPostingId || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        page,
        limit: pageSize,
      }),
    enabled: open,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => taApi.cancelTalentPoolInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool", "invitations"] });
      notify.success("Invitation cancelled", "The candidate can no longer accept it.");
    },
    onError: (err: any) => {
      notify.error("Unable to cancel invitation", err);
    },
  });

  const data = invitationsQuery.data;
  const items = data?.items || [];

  // Bulk cancel. Only pending invitations can be cancelled, so only those can be selected.
  const selection = useRowSelection(JSON.stringify([open, jobPostingId, statusFilter, page]));
  const selectedPending = items.filter((inv) => inv.status === "PENDING" && selection.selectedIds.has(String(inv.id)));
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ summary: BulkSummary; names: Record<number, string> } | null>(null);
  const bulkCancelMutation = useMutation({
    mutationFn: (rows: InvitationRow[]) => taApi.bulkCancelInvitations({ ids: rows.map((inv) => inv.id) }),
    onSuccess: (summary, rows) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool", "invitations"] });
      selection.remove(summary.results.filter((row) => row.ok).map((row) => String(row.id)));
      setBulkConfirmOpen(false);
      if (summary.failed > 0) {
        setBulkResult({ summary, names: Object.fromEntries(rows.map((inv) => [inv.id, inv.candidateName])) });
      } else {
        notify.success("Invitations cancelled", `${summary.succeeded} ${summary.succeeded === 1 ? "candidate" : "candidates"} can no longer accept.`);
      }
    },
    onError: (err: any) => notify.error("Unable to cancel invitations", err),
  });
  const totalPages = data?.totalPages || 1;

  const [invitationToCancel, setInvitationToCancel] = useState<InvitationRow | null>(null);

  const statusText = (inv: InvitationRow) => {
    const style = STATUS_STYLES[inv.status] ?? STATUS_STYLES.PENDING;
    return (
      <span>
        <span className={cn("font-medium", style.className)}>{style.label}</span>
        {inv.responseChannel && inv.responseChannel !== "PORTAL" && (
          <span className="block text-xs text-slate-600">{CHANNEL_LABELS[inv.responseChannel] ?? inv.responseChannel}</span>
        )}
        {inv.declineReason && (
          <span className="block text-xs text-slate-600">
            {inv.declineReason.replace(/_/g, " ").toLowerCase().replace(/^./, (ch: string) => ch.toUpperCase())}
          </span>
        )}
      </span>
    );
  };

  const sentText = (inv: InvitationRow) => (
    <span>
      <span className="block">Sent {formatDate(inv.createdAt)}</span>
      {inv.expiresAt && inv.status === "PENDING" && (
        <span className="block text-xs text-amber-800">Expires {formatDate(inv.expiresAt)}</span>
      )}
    </span>
  );

  const cancelButton = (inv: InvitationRow) =>
    inv.status === "PENDING" ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <OfferReplyActions
          invitationId={inv.id}
          candidateName={inv.candidateName}
          jobTitle={inv.jobPostingTitle}
          hasPortalAccess={inv.hasPortalAccess ?? true}
          hasMobile={inv.hasMobile ?? false}
          maskedMobile={inv.maskedMobile}
        />
        <Button variant="ghost" size="sm" onClick={() => setInvitationToCancel(inv)}>
          Cancel invitation
        </Button>
      </div>
    ) : null;

  const columns: DataTableColumn<InvitationRow>[] = [
    {
      key: "candidate",
      header: "Candidate",
      cell: (inv) => (
        <span>
          <span className="block font-medium text-slate-900">{inv.candidateName}</span>
          <span className="block break-all text-xs text-slate-600">{inv.candidateEmail}</span>
        </span>
      ),
    },
    { key: "job", header: "Job opening", cell: (inv) => inv.jobPostingTitle },
    { key: "status", header: "Status", cell: statusText },
    { key: "sent", header: "Sent", cell: sentText },
    { key: "actions", header: "Action", align: "right", cell: cancelButton },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={TA_COPY.invitations.sent}
      description={jobPostingId ? "Invitations for this job opening" : "Review invitations sent to candidates"}
      size="lg"
    >
      <div className="space-y-4">
        {/* Filter Toolbar */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="w-48">
            <Select
              label="Filter status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "PENDING", label: "Pending" },
                { value: "ACCEPTED", label: "Accepted" },
                { value: "DECLINED", label: "Declined" },
                { value: "EXPIRED", label: "Expired" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
          </div>
          <span className="pt-5 text-sm text-slate-600">
            {data?.total || 0} total
          </span>
        </div>

        {/* Content */}
        {invitationsQuery.isLoading ? (
          <LoadingState variant="table" rows={4} />
        ) : invitationsQuery.isError ? (
          <ErrorState error={invitationsQuery.error} onRetry={() => invitationsQuery.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No invitations yet"
            description="Invitations you send to candidates appear here with their responses."
          />
        ) : (
          <div className="space-y-3">
            <DataTable
              caption="Sent invitations"
              columns={columns}
              rows={items}
              getRowId={(inv) => String(inv.id)}
              selection={{
                selectedIds: selection.selectedIds,
                onChange: selection.setSelectedIds,
                rowLabel: (inv) => `Select ${inv.candidateName}`,
                isRowSelectable: (inv) => inv.status === "PENDING",
              }}
              renderCard={(inv) => (
                <div className="space-y-1.5 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block font-medium text-slate-900">{inv.candidateName}</span>
                      <span className="block break-all text-xs text-slate-600">{inv.candidateEmail}</span>
                    </span>
                    {statusText(inv)}
                  </div>
                  <p className="text-slate-700">{inv.jobPostingTitle}</p>
                  <div className="flex items-center justify-between gap-3 text-slate-600">
                    {sentText(inv)}
                    {cancelButton(inv)}
                  </div>
                </div>
              )}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pt-2 border-t border-slate-100">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={data?.total || 0}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              </div>
            )}

            <BulkActionBar count={selectedPending.length} onClear={selection.clear}>
              <Button size="sm" variant="outline" onClick={() => setBulkConfirmOpen(true)}>
                Cancel invitations
              </Button>
            </BulkActionBar>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={invitationToCancel !== null}
        onClose={() => setInvitationToCancel(null)}
        onConfirm={() => {
          if (invitationToCancel) cancelMutation.mutate(invitationToCancel.id);
          setInvitationToCancel(null);
        }}
        title="Cancel this invitation?"
        description={
          invitationToCancel
            ? `${invitationToCancel.candidateName} will no longer be able to accept the invitation for ${invitationToCancel.jobPostingTitle}.`
            : undefined
        }
        confirmLabel="Cancel invitation"
        cancelLabel="Keep invitation"
        variant="danger"
        loading={cancelMutation.isPending}
      />
      <ConfirmDialog
        open={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={() => bulkCancelMutation.mutate(selectedPending)}
        title={`Cancel ${selectedPending.length} ${selectedPending.length === 1 ? "invitation" : "invitations"}?`}
        description="These candidates will no longer be able to accept their invitations. Invitations that are no longer pending are listed afterward."
        confirmLabel="Cancel invitations"
        cancelLabel="Keep invitations"
        variant="danger"
        loading={bulkCancelMutation.isPending}
      />
      <BulkResultDialog
        open={Boolean(bulkResult)}
        onClose={() => setBulkResult(null)}
        title="Cancel invitations"
        summary={bulkResult?.summary ?? null}
        labelFor={(id) => bulkResult?.names[id] ?? `Invitation ${id}`}
      />
    </Dialog>
  );
};
