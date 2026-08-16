import React, { useState, useEffect } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Input, Button } from "../../components/ui";
import { authApi } from "../../lib/api/auth.api";
import { ApiError } from "../../lib/api/client";
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Please enter a valid email address"),
});

export const ForgotPasswordPage: React.FC = () => {
  const search = useSearch({ strict: false }) as { email?: string };
  const [email, setEmail] = useState(search?.email || "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; debugResetLink?: string } | null>(null);

  useEffect(() => {
    if (search?.email && !email) {
      setEmail(search.email);
    }
  }, [search?.email]);

  const forgotMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (data) => {
      setSuccessInfo(data);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Failed to initiate password reset. Please try again.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message || "Invalid email address");
      return;
    }

    setValidationError(null);
    forgotMutation.mutate({ email: result.data.email });
  };

  if (successInfo) {
    return (
      <div className="space-y-6 text-center py-2">
        <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mx-auto border border-teal-200">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Recovery Request Processed</h2>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            If an account is associated with <strong className="font-mono text-slate-800">{email}</strong>, recovery instructions and a secure reset token have been generated.
          </p>
        </div>

        <div className="pt-2">
          <Link to="/login" search={email.trim() ? { email: email.trim() } : undefined}>
            <Button variant="outline" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />} className="w-full">
              Return to Sign In
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
          Reset Password
        </h2>
        <p className="text-xs text-slate-500">
          Enter your registered email address to receive password reset instructions.
        </p>
      </div>

      {/* Error banner */}
      {serverError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{serverError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Registered Email Address"
          type="email"
          autoComplete="email"
          placeholder="name@agency.com or applicant email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (validationError) setValidationError(null);
          }}
          error={validationError || undefined}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={forgotMutation.isPending}
          leftIcon={<KeyRound className="w-4 h-4" />}
          className="w-full mt-2"
        >
          Send Reset Instructions
        </Button>
      </form>

      {/* Back to login */}
      <div className="pt-4 border-t border-slate-100 text-center">
        <Link
          to="/login"
          search={email.trim() ? { email: email.trim() } : undefined}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </div>
  );
};
