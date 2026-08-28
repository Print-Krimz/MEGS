import React, { useState, useEffect } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Input, Button } from "../../components/ui";
import { authApi } from "../../lib/api/auth.api";
import {
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  LockKeyhole,
  Lock,
} from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";
import { maskEmail } from "../../lib/utils";

const emailSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Please enter a valid email address"),
});

const otpSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, "Please enter the 6-digit verification code"),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const ForgotPasswordPage: React.FC = () => {
  const search = useSearch({ strict: false }) as { email?: string };
  const isEmailLocked = Boolean(search?.email?.trim());
  const [email, setEmail] = useState(search?.email || "");
  const [step, setStep] = useState<"EMAIL" | "VERIFY_OTP" | "SET_PASSWORD" | "SUCCESS">("EMAIL");
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [passwordData, setPasswordData] = useState({ password: "", confirmPassword: "" });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (search?.email && email !== search.email) {
      setEmail(search.email);
    }
  }, [search?.email]);

  // Cooldown countdown timer for resend
  useEffect(() => {
    if (step === "VERIFY_OTP" && cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, cooldown]);

  // Step 1 Mutation: Request OTP
  const forgotMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: () => {
      setServerError(null);
      setStep("VERIFY_OTP");
      setCooldown(60);
      notify.success("Verification Code Sent", "Please check your Gmail inbox for the 6-digit code.");
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
      notify.error("Recovery Request Failed", err);
    },
  });

  // Step 2 Mutation: Verify OTP & Receive Reset Session Token
  const verifyOtpMutation = useMutation({
    mutationFn: authApi.verifyOtp,
    onSuccess: (data) => {
      if (data.resetToken) {
        setResetToken(data.resetToken);
        setServerError(null);
        setStep("SET_PASSWORD");
        notify.success("Code Verified", "Please set your new security password.");
      } else {
        setServerError("Verification session could not be established. Please retry.");
      }
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
      notify.error("Verification Failed", err);
    },
  });

  // Resend OTP Mutation
  const resendMutation = useMutation({
    mutationFn: authApi.resendOtp,
    onSuccess: () => {
      setServerError(null);
      setCooldown(60);
      notify.success("Code Resent", "A new 6-digit verification code has been dispatched.");
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
      notify.error("Resend Failed", err);
    },
  });

  // Step 3 Mutation: Submit New Password
  const resetPasswordMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      setServerError(null);
      setStep("SUCCESS");
      notify.success("Password Updated", "Your account password has been successfully reset.");
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
      notify.error("Password Reset Failed", err);
    },
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setValidationErrors({ email: result.error.issues[0]?.message || "Invalid email address" });
      return;
    }

    setValidationErrors({});
    forgotMutation.mutate({ email: result.data.email });
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = otpSchema.safeParse({ otp: otpCode });
    if (!result.success) {
      setValidationErrors({ otp: result.error.issues[0]?.message || "Invalid 6-digit code" });
      return;
    }

    setValidationErrors({});
    verifyOtpMutation.mutate({
      email: email.trim(),
      otp: result.data.otp,
      purpose: "PASSWORD_RESET",
    });
  };

  const handleResend = () => {
    if (cooldown > 0 || resendMutation.isPending) return;
    setServerError(null);
    resendMutation.mutate({
      email: email.trim(),
      purpose: "PASSWORD_RESET",
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = passwordSchema.safeParse(passwordData);
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
    resetPasswordMutation.mutate({
      token: resetToken,
      password: result.data.password,
    });
  };

  if (step === "SUCCESS") {
    return (
      <div className="space-y-6 text-center py-2">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Password Reset Complete</h2>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Your new security password has been saved. You can now sign in with your updated credentials.
          </p>
        </div>

        <div className="pt-2">
          <Link to="/login" search={{ email: email.trim() }}>
            <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />} className="w-full">
              Proceed to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (step === "SET_PASSWORD") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Code Verified</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Set New Password
          </h2>
          <p className="text-xs text-slate-500">
            Create a secure new password for <strong className="font-mono text-slate-800">{maskEmail(email)}</strong>.
          </p>
        </div>

        {/* Global Server Error Banner */}
        {serverError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{serverError}</span>
          </div>
        )}

        {/* New Password Form */}
        <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
          <Input
            label="New Password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={passwordData.password}
            onChange={(e) => {
              setPasswordData((prev) => ({ ...prev, password: e.target.value }));
              if (validationErrors.password) {
                setValidationErrors((prev) => ({ ...prev, password: "" }));
              }
            }}
            error={validationErrors.password}
            helperText="Minimum 8 characters"
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter new password"
            value={passwordData.confirmPassword}
            onChange={(e) => {
              setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }));
              if (validationErrors.confirmPassword) {
                setValidationErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }
            }}
            error={validationErrors.confirmPassword}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={resetPasswordMutation.isPending}
            leftIcon={<LockKeyhole className="w-4 h-4" />}
            className="w-full mt-2"
          >
            Update Password
          </Button>
        </form>
      </div>
    );
  }

  if (step === "VERIFY_OTP") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[11px] font-medium border border-blue-200 mb-1">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Password Recovery Code</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Enter 6-Digit Code
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Enter the 6-digit reset code sent to <strong className="font-mono text-slate-800">{maskEmail(email)}</strong>.
          </p>
        </div>

        {/* Global Server Error Banner */}
        {serverError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{serverError}</span>
          </div>
        )}

        {/* OTP Form */}
        <form onSubmit={handleOtpSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="reset-otp-input" className="block text-xs font-semibold text-slate-700 mb-1">
              6-Digit Verification Code <span className="text-rose-500">*</span>
            </label>
            <input
              id="reset-otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
              placeholder="••••••"
              value={otpCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtpCode(val);
                if (validationErrors.otp) {
                  setValidationErrors({});
                }
              }}
              className="w-full text-center text-2xl font-mono tracking-[0.4em] font-bold py-2.5 px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-slate-900"
            />
            {validationErrors.otp && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{validationErrors.otp}</p>
            )}
            <p className="text-[11px] text-slate-400 mt-1.5 text-center">Code expires in 10 minutes</p>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={verifyOtpMutation.isPending}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full"
            disabled={otpCode.length !== 6}
          >
            Verify Code
          </Button>
        </form>

        {/* Resend Controls */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {isEmailLocked ? (
            <Link
              to="/login"
              search={{ email: email.trim() }}
              className="text-slate-500 hover:text-slate-800 hover:underline inline-flex items-center gap-1 text-[11px]"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Sign In</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setStep("EMAIL");
                setServerError(null);
              }}
              className="text-slate-500 hover:text-slate-800 hover:underline inline-flex items-center gap-1 text-[11px]"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Change Email</span>
            </button>
          )}

          <button
            type="button"
            disabled={cooldown > 0 || resendMutation.isPending}
            onClick={handleResend}
            className={`inline-flex items-center gap-1 font-medium ${
              cooldown > 0
                ? "text-slate-400 cursor-not-allowed"
                : "text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resendMutation.isPending ? "animate-spin" : ""}`} />
            <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}</span>
          </button>
        </div>
      </div>
    );
  }

  // Step 1: EMAIL
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1 text-center sm:text-left">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
          Reset Password
        </h2>
        <p className="text-xs text-slate-500">
          {isEmailLocked
            ? "Verify your account with a 6-digit code sent to your registered email address."
            : "Enter your registered email address to receive a 6-digit password reset code."}
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
      <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
        <Input
          label="Registered Email Address"
          type="email"
          autoComplete="email"
          placeholder="name@agency.com or applicant email"
          value={isEmailLocked ? maskEmail(email) : email}
          readOnly={isEmailLocked}
          leftIcon={isEmailLocked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : undefined}
          onChange={(e) => {
            if (isEmailLocked) return;
            setEmail(e.target.value);
            if (validationErrors.email) {
              setValidationErrors({});
            }
          }}
          error={validationErrors.email}
          helperText={isEmailLocked ? "Account email cannot be modified during recovery" : undefined}
          className={isEmailLocked ? "bg-slate-100 text-slate-700 cursor-not-allowed font-medium" : ""}
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
          Send Verification Code
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
