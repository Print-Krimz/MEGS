import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Input, Button } from "../../components/ui";
import { authApi } from "../../lib/api/auth.api";
import { UserPlus, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, RefreshCw } from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";
import { maskEmail } from "../../lib/utils";

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

const otpSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, "Please enter the 6-digit verification code"),
});

export const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"REGISTER" | "VERIFY_OTP" | "SUCCESS">("REGISTER");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  // Cooldown countdown timer for resend
  useEffect(() => {
    if (step === "VERIFY_OTP" && cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, cooldown]);

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      setServerError(null);
      setStep("VERIFY_OTP");
      setCooldown(60);
      notify.success("Verification Code Sent", "Please check your Gmail inbox for the 6-digit code.");
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
      notify.error("Registration Failed", err);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: authApi.verifyOtp,
    onSuccess: () => {
      setServerError(null);
      setStep("SUCCESS");
      notify.success("Account Verified", "Your email has been verified successfully.");
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
      notify.error("Verification Failed", err);
    },
  });

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

  const handleRegisterSubmit = (e: React.FormEvent) => {
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

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = otpSchema.safeParse({ otp: otpCode });
    if (!result.success) {
      setValidationErrors({ otp: result.error.issues[0]?.message || "Invalid 6-digit code" });
      return;
    }

    setValidationErrors({});
    verifyMutation.mutate({
      email: formData.email.trim(),
      otp: result.data.otp,
      purpose: "REGISTRATION",
    });
  };

  const handleResend = () => {
    if (cooldown > 0 || resendMutation.isPending) return;
    setServerError(null);
    resendMutation.mutate({
      email: formData.email.trim(),
      purpose: "REGISTRATION",
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

  if (step === "SUCCESS") {
    return (
      <div className="space-y-6 text-center py-2">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Email Verified Successfully</h2>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Your candidate portal account (<strong className="font-mono text-slate-800">{maskEmail(formData.email)}</strong>) is now active. You can sign in to build your profile and apply for opportunities.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/login" search={{ email: formData.email.trim() }}>
            <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />} className="w-full">
              Proceed to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (step === "VERIFY_OTP") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[11px] font-medium border border-teal-200 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Email Verification Required</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Enter 6-Digit Code
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            We sent a 6-digit verification code to <strong className="font-mono text-slate-800">{maskEmail(formData.email)}</strong>. Enter it below to activate your account.
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
            <label htmlFor="otp-input" className="block text-xs font-semibold text-slate-700 mb-1">
              6-Digit Verification Code <span className="text-rose-500">*</span>
            </label>
            <input
              id="otp-input"
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
              className="w-full text-center text-2xl font-mono tracking-[0.4em] font-bold py-2.5 px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent bg-white text-slate-900"
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
            loading={verifyMutation.isPending}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full"
            disabled={otpCode.length !== 6}
          >
            Verify & Activate Account
          </Button>
        </form>

        {/* Resend Cooldown Controls */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setStep("REGISTER");
              setServerError(null);
            }}
            className="text-slate-500 hover:text-slate-800 hover:underline inline-flex items-center gap-1 text-[11px]"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Edit Email</span>
          </button>

          <button
            type="button"
            disabled={cooldown > 0 || resendMutation.isPending}
            onClick={handleResend}
            className={`inline-flex items-center gap-1 font-medium ${
              cooldown > 0
                ? "text-slate-400 cursor-not-allowed"
                : "text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resendMutation.isPending ? "animate-spin" : ""}`} />
            <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}</span>
          </button>
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
      <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
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

      {/* Login link */}
      <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold text-teal-700 hover:text-teal-900 hover:underline"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
};
