import React from "react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";

export interface IdleWarningDialogProps {
  open: boolean;
  secondsLeft: number;
  onStay: () => void;
}

const formatCountdown = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Last chance before an idle staff session signs out. Closing the dialog by any route counts as staying. */
export const IdleWarningDialog: React.FC<IdleWarningDialogProps> = ({ open, secondsLeft, onStay }) => (
  <Dialog
    open={open}
    onClose={onStay}
    size="sm"
    title="Are you still there?"
    description="For security, MEGS signs you out after 1 hour without activity."
  >
    <p className="text-sm text-slate-700">
      Signing out in{" "}
      <span role="timer" className="font-semibold tabular-nums text-slate-950">
        {formatCountdown(secondsLeft)}
      </span>
    </p>
    <div className="mt-4 flex justify-end border-t border-slate-200 pt-3">
      <Button size="sm" onClick={onStay}>
        Stay signed in
      </Button>
    </div>
  </Dialog>
);
