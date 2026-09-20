import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { Dialog, Button, Select } from "../ui";
import { LoadingState, ErrorState, EmptyState, Pagination } from "../common";
import { formatDate } from "../../lib/utils";
import { notify } from "../../lib/feedback";
import { Clock, CheckCircle2, XCircle, AlertTriangle, Trash2 } from "lucide-react";

export interface InvitationsTrackerDrawerProps {
  open: boolean;
  onClose: () => void;
  jobPostingId?: number;
}

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
      notify.success("Invitation Cancelled", "The candidate invitation was cancelled.");
    },
    onError: (err: any) => {
      notify.error("Unable to cancel invitation", err);
    },
  });

  const data = invitationsQuery.data;
  const items = data?.items || [];
  const totalPages = data?.totalPages || 1;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>ACCEPTED</span>
          </span>
        );
      case "DECLINED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>DECLINED</span>
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>EXPIRED</span>
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200">
            <span>CANCELLED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>PENDING</span>
          </span>
        );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sent invitations"
      description={
        jobPostingId
          ? `Invitations for job opening #${jobPostingId}`
          : "Review invitations sent to candidates"
      }
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
          <span className="text-xs font-mono text-slate-500 pt-5">
            Total: {data?.total || 0}
          </span>
        </div>

        {/* Content */}
        {invitationsQuery.isLoading ? (
          <LoadingState variant="table" rows={4} />
        ) : invitationsQuery.isError ? (
          <ErrorState error={invitationsQuery.error} onRetry={() => invitationsQuery.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="w-6 h-6 text-slate-400" />}
            title="No job invitations found"
            description="Invitations sent to talent pool candidates will appear here with real-time response tracking."
          />
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Candidate</th>
                    <th className="px-3 py-2 font-semibold">Job opening</th>
                    <th className="px-3 py-2 font-semibold text-center">Status</th>
                    <th className="px-3 py-2 font-semibold">Sent / Expires</th>
                    <th className="px-3 py-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {items.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900 font-sans">{inv.candidateName}</div>
                        <div className="text-[11px] text-slate-400">{inv.candidateEmail}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-800 font-sans">{inv.jobPostingTitle}</div>
                        <div className="text-xs text-slate-500">Job opening #{inv.jobPostingId}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {getStatusBadge(inv.status)}
                        {inv.declineReason && (
                          <div className="text-[10px] text-rose-600 mt-0.5">
                            {inv.declineReason.replace(/_/g, " ")}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-500">
                        <div>Sent: {formatDate(inv.createdAt)}</div>
                        {inv.expiresAt && inv.status === "PENDING" && (
                          <div className="text-amber-600 text-[10px]">
                            Expires: {formatDate(inv.expiresAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {inv.status === "PENDING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(inv.id)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
