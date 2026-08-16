import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Input, Button } from "../../components/ui";
import { authApi } from "../../lib/api/auth.api";
import { ApiError } from "../../lib/api/client";
import { UserPlus, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

const registerSchema = z
  .object({
    email: z.string().trim().min(1, "Email is required").email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      setIsSuccess(true);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Failed to create candidate account. Please try again.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = registerSchema.safeParse(formData);
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
    registerMutation.mutate({
      email: result.data.email,
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
          <h2 className="text-xl font-bold text-slate-900">Account Created Successfully</h2>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Your candidate portal account (<strong className="font-mono text-slate-800">{formData.email}</strong>) has been registered. You can now log in to build your profile and apply for jobs.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/login">
            <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />} className="w-full">
              Proceed to Sign In
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
          Create Candidate Account
        </h2>
        <p className="text-xs text-slate-500">
          Register to explore job opportunities and track application milestones.
        </p>
      </div>

      {/* Global Server Error Banner */}
      {serverError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{serverError}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="your.email@example.com"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          error={validationErrors.email}
          required
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={(e) => handleChange("password", e.target.value)}
          error={validationErrors.password}
          helperText="Minimum 8 characters with letters & numbers"
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
          loading={registerMutation.isPending}
          leftIcon={<UserPlus className="w-4 h-4" />}
          className="w-full mt-2"
        >
          Create Candidate Account
        </Button>
      </form>

      {/* Login link & Return home */}
      <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600 space-y-2">
        <div>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-teal-700 hover:text-teal-900 hover:underline"
          >
            Sign In
          </Link>
        </div>
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:underline font-mono"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Return to Landing Page</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
