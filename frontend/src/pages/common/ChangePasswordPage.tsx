import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Input, Button } from "../../components/ui";
import { authApi } from "../../lib/api/auth.api";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { ApiError } from "../../lib/api/client";
import { KeyRound, AlertCircle, ShieldAlert } from "lucide-react";

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

export const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser, mustChangePassword } = useAuth();

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const changeMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: async () => {
      await refreshUser();

      if (user?.role === Role.ADMINISTRATOR) {
        navigate({ to: "/admin" });
      } else if (user?.role === Role.TALENT_ACQUISITION) {
        navigate({ to: "/ta" });
      } else {
        navigate({ to: "/app" });
      }
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Failed to update password. Please check your current password.");
      }
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
    <div className="space-y-6">
      {/* Notice header */}
      <div className="space-y-1 text-center sm:text-left">
        <div className="flex items-center gap-2 text-amber-700 mb-1">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider">
            {mustChangePassword ? "Mandatory Security Requirement" : "Security Update"}
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
          Update Your Password
        </h2>
        <p className="text-xs text-slate-500">
          {mustChangePassword
            ? "Your account requires an immediate password update before you can continue."
            : "Set a strong, unique password to secure your account."}
        </p>
      </div>

      {/* Global Server Error Banner */}
      {serverError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{serverError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Current Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter current password"
          value={formData.currentPassword}
          onChange={(e) => handleChange("currentPassword", e.target.value)}
          error={validationErrors.currentPassword}
          required
        />

        <Input
          label="New Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={formData.newPassword}
          onChange={(e) => handleChange("newPassword", e.target.value)}
          error={validationErrors.newPassword}
          helperText="Minimum 8 characters with letters & numbers"
          required
        />

        <Input
          label="Confirm New Password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter new password"
          value={formData.confirmPassword}
          onChange={(e) => handleChange("confirmPassword", e.target.value)}
          error={validationErrors.confirmPassword}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={changeMutation.isPending}
          leftIcon={<KeyRound className="w-4 h-4" />}
          className="w-full mt-2"
        >
          Save & Proceed
        </Button>
      </form>
    </div>
  );
};
