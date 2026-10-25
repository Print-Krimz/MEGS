import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../lib/api/ta.api";
import { notify } from "../lib/feedback";
import type { BulkSummary } from "../lib/types/application.types";

interface BatchInviteRow {
  applicantProfileId: number;
  success: boolean;
  error?: string;
}

/**
 * Sends one invitation to many pool candidates through the batch endpoint. `onSent` receives the profile ids that
 * went through so the page can drop them from its selection. Failures come back as a summary for BulkResultDialog.
 */
export function useBulkInvite(onSent: (profileIds: number[]) => void) {
  const queryClient = useQueryClient();
  const [failures, setFailures] = useState<BulkSummary | null>(null);

  const mutation = useMutation({
    mutationFn: taApi.batchSendTalentPoolInvitations,
    onSuccess: (data) => {
      const summary: BulkSummary = {
        succeeded: data.sentCount,
        failed: data.failedCount,
        results: (data.results as BatchInviteRow[]).map((row) => ({
          id: row.applicantProfileId,
          ok: row.success,
          reason: row.error,
        })),
      };
      onSent(summary.results.filter((row) => row.ok).map((row) => row.id));
      void queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool"] });
      void queryClient.invalidateQueries({ queryKey: ["ta", "redeployment-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["ta", "redeployment-suggestions"] });
      if (summary.failed > 0) setFailures(summary);
      else {
        notify.success(
          "Invitations sent",
          `${summary.succeeded} ${summary.succeeded === 1 ? "candidate is" : "candidates are"} notified.`
        );
      }
    },
    onError: (err: unknown) => notify.error("Unable to send invitations", err),
  });

  return { mutation, failures, clearFailures: () => setFailures(null) };
}
