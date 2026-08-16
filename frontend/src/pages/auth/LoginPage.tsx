import React, { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Input, Button } from "../../components/ui";
import { authApi } from "../../lib/api/auth.api";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { ApiError } from "../../lib/api/client";
import { LogIn, AlertCircle, ArrowLeft } from "lucide-react";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string; email?: string };
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: search?.email || "",
    password: "",
  });

  React.useEffect(() => {
    if (search?.email && !formData.email) {
      setFormData((prev) => ({ ...prev, email: search.email || "" }));
    }
  }, [search?.email]);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      login(data);

      if (data.user.mustChangePassword) {
        navigate({ to: "/change-password" });
        return;
      }

      // Safe internal redirect validation against open redirects
      if (
        search?.redirect &&
        search.redirect.startsWith("/") &&
        !search.redirect.startsWith("//") &&
        search.redirect !== "/login"
      ) {
        window.location.href = search.redirect;
        return;
      }

      if (data.user.role === Role.ADMINISTRATOR) {
        navigate({ to: "/admin" });
      } else if (data.user.role === Role.TALENT_ACQUISITION) {
        navigate({ to: "/ta" });
      } else {
        navigate({ to: "/app" });
      }
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Failed to sign in. Please verify your credentials and network connection.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = loginSchema.safeParse(formData);
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
    loginMutation.mutate(result.data);
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
      {/* Title */}
      <div className="space-y-1 text-center sm:text-left">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
          Sign In
        </h2>
        <p className="text-xs text-slate-500">
          Enter your authorized credentials to access the recruitment workspace.
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
          id="login-email"
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="name@agency.com or applicant email"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          error={validationErrors.email}
          required
        />

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
              Password <span className="text-rose-500">*</span>
            </label>
            <Link
              to="/forgot-password"
              search={formData.email.trim() ? { email: formData.email.trim() } : undefined}
              className="text-xs text-teal-700 hover:text-teal-900 font-medium hover:underline"
              tabIndex={-1}
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            error={validationErrors.password}
            required
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={loginMutation.isPending}
          leftIcon={<LogIn className="w-4 h-4" />}
          className="w-full mt-2"
        >
          Sign In
        </Button>
      </form>

      {/* Register & Back Link Footer */}
      <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600 space-y-2">
        <div>
          Applying for job opportunities?{" "}
          <Link
            to="/register"
            className="font-semibold text-teal-700 hover:text-teal-900 hover:underline"
          >
            Create Candidate Account
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
