import React, { useState } from "react";
import { AlertTriangle, LogOut } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { useAuth } from "../../hooks/useAuth";

export interface SignOutDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => Promise<void> | void;
  title?: React.ReactNode;
  description?: React.ReactNode;
}

export const SignOutDialog: React.FC<SignOutDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title = "Sign Out Confirmation",
  description = "Are you sure you want to sign out? Any unsaved changes will be lost, and you will need to sign in again to access the portal.",
}) => {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (onConfirm) {
        await onConfirm();
      } else {
        await logout();
      }
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={() => !loading && onClose()} size="sm">
      <div className="flex items-start gap-3.5">
        <div className="p-2 bg-amber-100 border border-amber-300 shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-700" />
        </div>
        <div className="space-y-1 flex-1">
          <h3 className="text-xs font-bold text-slate-950 font-mono uppercase tracking-wide">
            {title}
          </h3>
          <p className="text-xs text-slate-600 leading-normal font-sans">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={loading}
          onClick={handleConfirm}
          leftIcon={<LogOut className="w-3.5 h-3.5" />}
        >
          Sign Out
        </Button>
      </div>
    </Dialog>
  );
};
