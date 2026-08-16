import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Input, Button } from "../../components/ui";
import { authApi } from "../../lib/api/auth.api";
import { ApiError } from "../../lib/api/client";
import { ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

const setupSchema = z
  .object({
    token: z.string().min(1, "Setup invitation token is required"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const SetupAccountPage: React.FC = () => {
  const params = useParams({ strict: false }) as { token?: string };
  const routeToken = params?.token || "";

  const [formData, setFormData] = useState({
    token: routeToken,
    password: "",
    confirmPassword: "",
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const setupMutation = useMutation({
    mutationFn: authApi.setupAccount,
    onSuccess: () => {
      setIsSuccess(true);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Failed to activate account. The invitation link may have expired or already been used.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = setupSchema.safeParse(formData);
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
    setupMutation.mutate({
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
      <div className="space-y-6 text-center py-2">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Account Activated</h2>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Your MEGS recruiter/staff account is now active and ready for operational use.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/login">
            <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />} className="w-full">
              Sign In to Operational Workspace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1 text-center sm:text-left">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
          Staff Account Setup
        </h2>
        <p className="text-xs text-slate-500">
          Set up your master password to complete your invited recruiter workspace setup.
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
        {!routeToken && (
          <Input
            label="Invitation Token"
            type="text"
            placeholder="Paste your invitation token"
            value={formData.token}
            onChange={(e) => handleChange("token", e.target.value)}
            error={validationErrors.token}
            required
          />
        )}

        <Input
          label="Set Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={(e) => handleChange("password", e.target.value)}
          error={validationErrors.password}
          helperText="Minimum 8 characters"
          required
        />

        <Input
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter password"
          value={formData.confirmPassword}
          onChange={(e) => handleChange("confirmPassword", e.target.value)}
          error={validationErrors.confirmPassword}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={setupMutation.isPending}
          leftIcon={<ShieldCheck className="w-4 h-4" />}
          className="w-full mt-2"
        >
          Activate Account
        </Button>
      </form>
    </div>
  );
};
