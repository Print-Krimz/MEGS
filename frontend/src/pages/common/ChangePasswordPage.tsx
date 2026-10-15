import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/shadcn/button";
import { FieldGroup } from "@/components/shadcn/field";
import { Spinner } from "@/components/shadcn/spinner";
import { AuthPasswordField } from "../../components/auth/AuthField";
import { AuthError, AuthHeading } from "../../components/auth/AuthChrome";
import { authApi } from "../../lib/api/auth.api";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
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
      notify.success("Password Updated", "Your security password has been changed successfully.");

      if (user?.role === Role.ADMINISTRATOR) {
        navigate({ to: "/admin" });
      } else if (user?.role === Role.TALENT_ACQUISITION) {
        navigate({ to: "/ta" });
      } else {
        navigate({ to: "/app" });
      }
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

  const goHome = () => {
    if (user?.role === Role.ADMINISTRATOR) navigate({ to: "/admin" });
    else if (user?.role === Role.TALENT_ACQUISITION) navigate({ to: "/ta" });
    else navigate({ to: "/app" });
  };

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading
        title="Update your password"
        description={
          mustChangePassword
            ? "Your account requires a new password before you can continue."
            : "Choose a strong, unique password to keep your account secure."
        }
      />

      <AuthError message={serverError} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <FieldGroup>
          <AuthPasswordField
            id="change-current-password"
            label="Current password"
            autoComplete="current-password"
            placeholder="Enter your current password"
            value={formData.currentPassword}
            onChange={(e) => handleChange("currentPassword", e.target.value)}
            error={validationErrors.currentPassword}
            required
          />

          <AuthPasswordField
            id="change-new-password"
            label="New password"
            autoComplete="new-password"
            placeholder="Create a new password"
            value={formData.newPassword}
            onChange={(e) => handleChange("newPassword", e.target.value)}
            error={validationErrors.newPassword}
            hint="Use at least 8 characters, different from your current password."
            showStrength
            required
          />

          <AuthPasswordField
            id="change-confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={formData.confirmPassword}
            onChange={(e) => handleChange("confirmPassword", e.target.value)}
            error={validationErrors.confirmPassword}
            required
          />
        </FieldGroup>

        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" className="w-full" disabled={changeMutation.isPending}>
            {changeMutation.isPending && <Spinner data-icon="inline-start" />}
            Update password
          </Button>
          {!mustChangePassword && (
            <Button type="button" variant="ghost" size="lg" className="w-full text-muted-foreground" onClick={goHome}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
