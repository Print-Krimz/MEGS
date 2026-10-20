import React, { useEffect } from "react";
import { Dialog, PasswordInput, Button } from "../ui";
import { KeyRound, AlertCircle } from "lucide-react";
import { PASSWORD_MAX_BYTES } from "../../lib/password-strength";
import { useChangePassword, CHANGE_PASSWORD_COPY } from "../../hooks/useChangePassword";

export interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, onClose }) => {
  const { values, errors, serverError, isPending, setField, submit, reset } = useChangePassword({
    mode: "close",
    onDone: onClose,
  });

  // Clear the form whenever the modal closes.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Update your password"
      description="Choose a strong, unique password to keep your account secure."
      size="md"
    >
      <div className="space-y-4">
        {serverError && (
          <div role="alert" className="flex items-start gap-2 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span className="leading-relaxed">{serverError}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <PasswordInput
            label={CHANGE_PASSWORD_COPY.currentPassword}
            autoComplete="current-password"
            placeholder="Enter your current password"
            value={values.currentPassword}
            onChange={(e) => setField("currentPassword", e.target.value)}
            error={errors.currentPassword}
            required
          />

          <PasswordInput
            label={CHANGE_PASSWORD_COPY.newPassword}
            autoComplete="new-password"
            placeholder="Create a new password"
            value={values.newPassword}
            maxLength={PASSWORD_MAX_BYTES}
            onChange={(e) => setField("newPassword", e.target.value)}
            error={errors.newPassword}
            showStrengthIndicator
            required
          />

          <PasswordInput
            label={CHANGE_PASSWORD_COPY.confirmPassword}
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={values.confirmPassword}
            maxLength={PASSWORD_MAX_BYTES}
            onChange={(e) => setField("confirmPassword", e.target.value)}
            error={errors.confirmPassword}
            required
          />

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={isPending} leftIcon={<KeyRound className="h-3.5 w-3.5" />}>
              {CHANGE_PASSWORD_COPY.submit}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
};
