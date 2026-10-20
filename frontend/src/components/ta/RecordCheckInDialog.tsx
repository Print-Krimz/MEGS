import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Input, Textarea } from "../ui";
import { taApi } from "../../lib/api/ta.api";
import { getManilaToday } from "../../lib/field-limits";
import { formatDate } from "../../lib/utils";
import { notify } from "../../lib/feedback";

export const RecordCheckInDialog: React.FC<{
  open: boolean;
  deploymentId: string | number;
  employeeName: string;
  onClose: () => void;
}> = ({ open, deploymentId, employeeName, onClose }) => {
  const queryClient = useQueryClient();
  const [nextReviewAt, setNextReviewAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setNextReviewAt("");
    setNotes("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!nextReviewAt) throw new Error("Choose the next check-in date.");
      return taApi.recordDeploymentReview(deploymentId, { nextReviewAt, notes: notes.trim() || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "deployment"] });
      onClose();
      notify.success("Check-in recorded", "The next assignment review is scheduled.");
    },
    onError: (error: any) => notify.error("Could not record check-in", error?.message || error),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record assignment check-in"
      description={`Record a check-in for ${employeeName} and set the next review date.`}
    >
      <div className="space-y-4">
        <Input
          label="Next check-in date"
          type="date"
          value={nextReviewAt}
          min={getManilaToday()}
          onChange={(event) => setNextReviewAt(event.target.value)}
          helperText={nextReviewAt ? formatDate(nextReviewAt) : "Choose today or a later date."}
          required
        />
        <Textarea
          label="Check-in notes (optional)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Record whether the worker and client expect the assignment to continue."
        />
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!nextReviewAt} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save check-in
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
