import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
import { Button, Dialog, Textarea } from "../../ui";
import {
  BulkActionBar,
  BulkReasonDialog,
  BulkResultDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  SelectBox,
} from "../../common";
import { useRowSelection } from "../../../hooks/useRowSelection";
import { notify } from "../../../lib/feedback";
import { pollInterval } from "../../../lib/query-policies";
import { useLiveStreamConnected } from "../../../lib/live-stream-status";
import { EncodeWalkInDialog } from "./EncodeWalkInDialog";
import type { BulkSummary, CheckInDetail, CheckInSummary, WalkInSlip } from "../../../lib/types/application.types";

const REFRESH_MS = 30_000;
const REASON_MAX = 300;

/** Shared list query so the tab count and the panel stay in step. */
export const useCheckIns = () => {
  const streamConnected = useLiveStreamConnected();
  return useQuery({
    queryKey: ["ta", "check-ins"],
    queryFn: ({ signal }) => taApi.listCheckIns({ signal }),
    refetchInterval: pollInterval(REFRESH_MS, streamConnected),
  });
};

/** "just now", "12 min", "1 h 5 min". */
export const formatWaiting = (createdAt: string, now: number = Date.now()): string => {
  const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const fullName = (c: CheckInSummary) => [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ");

interface CheckInsPanelProps {
  onConfirmed: (slip: WalkInSlip) => void;
}

export const CheckInsPanel: React.FC<CheckInsPanelProps> = ({ onConfirmed }) => {
  const queryClient = useQueryClient();
  const query = useCheckIns();
  const [detail, setDetail] = useState<CheckInDetail | null>(null);
  const [dismissing, setDismissing] = useState<CheckInSummary | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const loadMutation = useMutation({
    mutationFn: (id: number) => taApi.getCheckIn(id),
    onSuccess: setDetail,
    onError: (error) => {
      notify.error("Could not open the check-in", error);
      void queryClient.invalidateQueries({ queryKey: ["ta", "check-ins"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (vars: { id: number; reason: string }) => taApi.dismissCheckIn(vars.id, vars.reason),
    onSuccess: () => {
      notify.success("Check-in dismissed", `${dismissing ? fullName(dismissing) : "The applicant"} was removed from the list.`);
      closeDismiss();
      void queryClient.invalidateQueries({ queryKey: ["ta", "check-ins"] });
    },
    onError: (error) => notify.error("Could not dismiss the check-in", error),
  });

  // Bulk dismiss. The list refreshes every 30 seconds, so the selection is matched against what is still waiting.
  const selection = useRowSelection("check-ins");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ summary: BulkSummary; names: Record<number, string> } | null>(null);
  const bulkMutation = useMutation({
    mutationFn: (vars: { items: CheckInSummary[]; reason: string }) =>
      taApi.bulkDismissCheckIns({ ids: vars.items.map((item) => item.id), reason: vars.reason }),
    onSuccess: (summary, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["ta", "check-ins"] });
      selection.remove(summary.results.filter((row) => row.ok).map((row) => String(row.id)));
      setBulkOpen(false);
      if (summary.failed > 0) {
        setBulkResult({ summary, names: Object.fromEntries(vars.items.map((item) => [item.id, fullName(item)])) });
      } else {
        notify.success("Check-ins dismissed", `${summary.succeeded} ${summary.succeeded === 1 ? "applicant was" : "applicants were"} removed from the list.`);
      }
    },
    onError: (error) => notify.error("Could not dismiss the check-ins", error),
  });

  const closeDismiss = () => {
    setDismissing(null);
    setReason("");
    setReasonError("");
  };

  const submitDismiss = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dismissing) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError("Enter a reason.");
      return;
    }
    dismissMutation.mutate({ id: dismissing.id, reason: trimmed });
  };

  if (query.isLoading) return <LoadingState variant="table" rows={4} />;
  if (query.isError) return <ErrorState subject="check-ins" error={query.error} onRetry={() => query.refetch()} />;

  const items = query.data?.items ?? [];
  const now = Date.now();
  const selectedItems = items.filter((item) => selection.selectedIds.has(String(item.id)));
  const toggleItem = (id: string) =>
    selection.setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {items.length === 0 ? (
        <EmptyState bare title="No one is waiting." description="Applicants who scan the poster appear here." />
      ) : (
        <>
        <div className="flex items-center text-sm text-slate-700">
          <SelectBox
            checked={selectedItems.length === items.length}
            indeterminate={selectedItems.length > 0 && selectedItems.length < items.length}
            label="Select all waiting check-ins"
            onChange={() =>
              selection.setSelectedIds(
                selectedItems.length === items.length ? new Set() : new Set(items.map((item) => String(item.id)))
              )
            }
          />
          <span>Select all ({items.length})</span>
        </div>
        <BulkActionBar count={selectedItems.length} onClear={selection.clear}>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
            Dismiss
          </Button>
        </BulkActionBar>
        <ul aria-label="Waiting check-ins" className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
              <SelectBox
                checked={selection.selectedIds.has(String(item.id))}
                label={`Select ${item.queueNumber} ${fullName(item)}`}
                onChange={() => toggleItem(String(item.id))}
              />
              <span className="w-16 shrink-0 text-lg font-bold tabular-nums text-slate-900">{item.queueNumber}</span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-semibold text-slate-900">{fullName(item)}</p>
                <p className="truncate text-sm text-slate-600">
                  {item.jobTitle}
                  {item.clientName ? ` · ${item.clientName}` : ""}
                </p>
              </div>
              <span className="text-sm tabular-nums text-slate-600">
                <span className="sr-only">Waiting </span>
                {formatWaiting(item.createdAt, now)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-11 md:min-h-9"
                  disabled={loadMutation.isPending || dismissMutation.isPending}
                  aria-label={`Dismiss ${item.queueNumber} ${fullName(item)}`}
                  onClick={() => setDismissing(item)}
                >
                  Dismiss
                </Button>
                <Button
                  className="min-h-11 md:min-h-9"
                  loading={loadMutation.isPending && loadMutation.variables === item.id}
                  disabled={loadMutation.isPending}
                  aria-label={`Confirm ${item.queueNumber} ${fullName(item)}`}
                  onClick={() => loadMutation.mutate(item.id)}
                >
                  Confirm
                </Button>
              </div>
            </li>
          ))}
        </ul>
        </>
      )}

      <BulkReasonDialog
        open={bulkOpen}
        onClose={() => {
          if (!bulkMutation.isPending) setBulkOpen(false);
        }}
        title="Dismiss check-ins"
        description={`${selectedItems.length} ${selectedItems.length === 1 ? "check-in" : "check-ins"} will be dismissed with the same reason. Each applicant's phone will show that the check-in is closed.`}
        submitLabel={`Dismiss ${selectedItems.length}`}
        loading={bulkMutation.isPending}
        maxLength={REASON_MAX}
        onSubmit={(reason) => bulkMutation.mutate({ items: selectedItems, reason })}
      />
      <BulkResultDialog
        open={Boolean(bulkResult)}
        onClose={() => setBulkResult(null)}
        title="Dismiss check-ins"
        summary={bulkResult?.summary ?? null}
        labelFor={(id) => bulkResult?.names[id] ?? `Check-in ${id}`}
      />

      {detail && <EncodeWalkInDialog open checkIn={detail} onClose={() => setDetail(null)} onCreated={onConfirmed} />}

      <Dialog
        open={Boolean(dismissing)}
        onClose={() => {
          if (!dismissMutation.isPending) closeDismiss();
        }}
        title={dismissing ? `Dismiss check-in ${dismissing.queueNumber}` : "Dismiss check-in"}
        description="The applicant's phone will show that the check-in is closed."
        size="sm"
      >
        <form onSubmit={submitDismiss} noValidate className="space-y-4">
          <Textarea
            id="check-in-dismiss-reason"
            label="Reason"
            required
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError("");
            }}
            error={reasonError}
          />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={closeDismiss} disabled={dismissMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={dismissMutation.isPending}>
              Dismiss check-in
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
