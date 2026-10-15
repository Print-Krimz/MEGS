import React, { useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/shadcn/button";
import { FieldGroup } from "@/components/shadcn/field";
import { Spinner } from "@/components/shadcn/spinner";
import { AuthPasswordField, AuthTextField } from "../../components/auth/AuthField";
import { AuthError, AuthHeading } from "../../components/auth/AuthChrome";
import { authApi } from "../../lib/api/auth.api";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";
import { isWithinPasswordByteLimit, PASSWORD_MAX_BYTES, PASSWORD_MAX_BYTES_MESSAGE } from "../../lib/password-strength";

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is missing or invalid"),
    password: z.string().min(8, "Password must be at least 8 characters long").refine(isWithinPasswordByteLimit, PASSWORD_MAX_BYTES_MESSAGE),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const ResetPasswordPage: React.FC = () => {
  const search = useSearch({ strict: false }) as { token?: string };
  const queryToken = search?.token || "";

  const getInitialToken = () => {
    if (queryToken) return queryToken;
    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      return hashParams.get("access_token") || hashParams.get("token") || "";
    }
    return "";
  };

  const [formData, setFormData] = useState({
    token: getInitialToken(),
    password: "",
    confirmPassword: "",
  });

  React.useEffect(() => {
    const extracted = getInitialToken();
    if (extracted && !formData.token) {
      setFormData((prev) => ({ ...prev, token: extracted }));
    }
  }, [queryToken]);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const resetMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      setIsSuccess(true);
      notify.success("Password Reset Complete", "Your new password has been saved.");
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
      notify.error("Password Reset Failed", err);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = resetPasswordSchema.safeParse(formData);
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
    resetMutation.mutate({
      token: result.data.token,
      password: result.data.password,
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

  if (isSuccess) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <AuthHeading
            focusOnMount
            title="Password Reset Complete"
            description="Your password is updated. Sign in with the new one."
          />
        </div>
        <Button asChild size="lg" className="w-full">
          <Link to="/login">
            Sign In to Your Account
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading title="Set a new password" description="Choose a password you have not used before." />

      <AuthError message={serverError} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <FieldGroup>
          {!formData.token && (
            <AuthTextField
              id="reset-token"
              label="Reset Token"
              type="text"
              placeholder="Paste the reset token from your email"
              value={formData.token}
              onChange={(e) => handleChange("token", e.target.value)}
              error={validationErrors.token}
              required
            />
          )}

          <AuthPasswordField
            id="reset-new-password"
            label="New password"
            autoComplete="new-password"
            placeholder="Create a new password"
            value={formData.password}
            maxLength={PASSWORD_MAX_BYTES}
            onChange={(e) => handleChange("password", e.target.value)}
            error={validationErrors.password}
            showStrength
            required
          />

          <AuthPasswordField
            id="reset-confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={formData.confirmPassword}
            maxLength={PASSWORD_MAX_BYTES}
            onChange={(e) => handleChange("confirmPassword", e.target.value)}
            error={validationErrors.confirmPassword}
            required
          />
        </FieldGroup>

        <Button type="submit" size="lg" disabled={resetMutation.isPending} className="w-full">
          {resetMutation.isPending && <Spinner data-icon="inline-start" />}
          {resetMutation.isPending ? "Updating…" : "Update password"}
        </Button>
      </form>

      <p className="border-t border-border pt-6 text-center text-base">
        <Link
          to="/login"
          className="inline-block rounded-sm py-2 font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
};
