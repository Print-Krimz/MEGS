import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, PasswordInput, Button } from "../ui";
import { authApi } from "../../lib/api/auth.api";
import { useAuth } from "../../hooks/useAuth";
import { KeyRound, AlertCircle } from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters long"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  open,
  onClose,
}) => {
  const { refreshUser } = useAuth();

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset form whenever modal opens or closes
  useEffect(() => {
    if (!open) {
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setValidationErrors({});
      setServerError(null);
    }
  }, [open]);

  const changeMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: async () => {
      await refreshUser();
      notify.success("Password Updated", "Your security password has been changed successfully.");
      onClose();
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
      notify.error("Password Update Failed", err);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = changePasswordSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      }
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    changeMutation.mutate({
      currentPassword: result.data.currentPassword,
      newPassword: result.data.newPassword,
    });
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Account Security"
      description="Update your account password. Choose a strong, unique password to secure your account."
      size="md"
    >
      <div className="space-y-4">
        {/* Global Server Error Banner */}
        {serverError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <PasswordInput
            label="Current Password"
            autoComplete="current-password"
            placeholder="Enter current password"
            value={formData.currentPassword}
            onChange={(e) => handleChange("currentPassword", e.target.value)}
            error={validationErrors.currentPassword}
            required
          />

          <PasswordInput
            label="New Password"
            autoComplete="new-password"
            placeholder="Enter new password"
            value={formData.newPassword}
            onChange={(e) => handleChange("newPassword", e.target.value)}
            error={validationErrors.newPassword}
            showStrengthIndicator
            required
          />

          <PasswordInput
            label="Confirm New Password"
            autoComplete="new-password"
            placeholder="Re-enter new password"
            value={formData.confirmPassword}
            onChange={(e) => handleChange("confirmPassword", e.target.value)}
            error={validationErrors.confirmPassword}
            required
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={changeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={changeMutation.isPending}
              leftIcon={<KeyRound className="w-3.5 h-3.5" />}
            >
              Update Password
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
};
