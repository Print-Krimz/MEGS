import React, { useId } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  loading = false,
}) => {
  const titleId = useId();
  const descriptionId = useId();

  const iconMap = {
    danger: <AlertTriangle className="w-5 h-5 text-rose-600" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-600" />,
    primary: <AlertCircle className="w-5 h-5 text-navy" />,
  };

  const bgMap = {
    danger: "bg-rose-100",
    warning: "bg-amber-100",
    primary: "bg-navy-soft",
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabelledBy={titleId}
      ariaDescribedBy={description ? descriptionId : undefined}
    >
      <div className="flex items-start gap-3.5">
        <div className={`p-2 ${bgMap[variant]} border border-slate-300 rounded-md shrink-0`}>
          {iconMap[variant]}
        </div>
        <div className="space-y-1 flex-1">
          <h3 id={titleId} className="text-base font-semibold text-slate-950">{title}</h3>
          {description && (
            <p id={descriptionId} className="text-sm text-slate-600 leading-normal">{description}</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          size="sm"
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
};
