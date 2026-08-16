import React from "react";
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
  const iconMap = {
    danger: <AlertTriangle className="w-5 h-5 text-rose-600" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-600" />,
    primary: <AlertCircle className="w-5 h-5 text-teal-600" />,
  };

  const bgMap = {
    danger: "bg-rose-100",
    warning: "bg-amber-100",
    primary: "bg-teal-100",
  };

  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <div className="flex items-start gap-3.5">
        <div className={`p-2 ${bgMap[variant]} border border-slate-300 shrink-0`}>
          {iconMap[variant]}
        </div>
        <div className="space-y-1 flex-1">
          <h3 className="text-xs font-bold text-slate-950 font-mono uppercase">{title}</h3>
          {description && (
            <p className="text-xs text-slate-600 leading-normal">{description}</p>
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
