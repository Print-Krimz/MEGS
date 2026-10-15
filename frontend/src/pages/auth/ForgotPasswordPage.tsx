import React, { useState, useEffect } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/shadcn/button";
import { FieldGroup, FieldLabel } from "@/components/shadcn/field";
import { Spinner } from "@/components/shadcn/spinner";
import { AuthPasswordField, AuthTextField } from "../../components/auth/AuthField";
import { AuthError, AuthHeading, AuthStep, AuthStepper } from "../../components/auth/AuthChrome";
import { OtpCodeField } from "../../components/auth/OtpCodeField";
import { authApi } from "../../lib/api/auth.api";
import { TurnstileWidget, type TurnstileWidgetRef } from "../../components/common";
import { CheckCircle2, ArrowRight, ArrowLeft, RefreshCw } from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";
import { maskEmail } from "../../lib/utils";
import { useSecurityControls } from "../../hooks/useSecurityControls";

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
  const controls = useSecurityControls();
  const rateLimitDisabled = controls.data?.rateLimitDisabled === true && !controls.isError;
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [passwordData, setPasswordData] = useState({ password: "", confirmPassword: "" });
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = React.useRef<TurnstileWidgetRef>(null);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (search?.email && email !== search.email) {
      setEmail(search.email);
    }
  }, [search?.email]);

  useEffect(() => { if (rateLimitDisabled) setCooldown(0); }, [rateLimitDisabled, cooldown]);

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
    mutationFn: (variables: { data: { email: string }; turnstileToken?: string }) =>
      authApi.forgotPassword(variables.data, variables.turnstileToken),
    onSuccess: () => {
      setServerError(null);
      setStep("VERIFY_OTP");
      setCooldown(60);
      notify.success("Verification code sent", "Check your inbox for the 6-digit code. It may take a minute.");
    },
    onError: (err) => {
      turnstileRef.current?.reset();
      setTurnstileToken("");
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
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
        notify.success("Code verified", "Please set your new security password.");
      } else {
        setServerError("Verification session could not be established. Please retry.");
      }
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
    },
  });

  // Resend OTP Mutation
  const resendMutation = useMutation({
    mutationFn: authApi.resendOtp,
    onSuccess: () => {
      setServerError(null);
      setCooldown(60);
      notify.success("Code resent", "A new 6-digit verification code has been dispatched.");
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
    },
  });

  // Step 3 Mutation: Submit New Password
  const resetPasswordMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      setServerError(null);
      setStep("SUCCESS");
      notify.success("Password updated", "Your account password has been successfully reset.");
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
    },
  });

  // Off when the build disables it or the developer-owned DISABLE_CAPTCHA switch is on (Heroku).
  const isCaptchaDisabled =
    import.meta.env.VITE_DISABLE_CAPTCHA === "true" || (controls.data?.captchaDisabled === true && !controls.isError);
  const hasSiteKey = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  const isCaptchaRequired = hasSiteKey && !isCaptchaDisabled && import.meta.env.MODE !== "test";
  const isEmailFilled = email.trim().length > 0;
  const isSubmitDisabled = forgotMutation.isPending || !isEmailFilled || (isCaptchaRequired && !turnstileToken);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setValidationErrors({ email: result.error.issues[0]?.message || "Invalid email address" });
      return;
    }

    setValidationErrors({});

    if (isCaptchaRequired && !turnstileToken) {
      setServerError("Please complete or retry the security verification before continuing.");
      return;
    }

    forgotMutation.mutate({
      data: { email: result.data.email },
      turnstileToken,
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

  const STEPS = ["Email", "Verify", "New password", "Done"];
  const stepIndex = step === "EMAIL" ? 0 : step === "VERIFY_OTP" ? 1 : step === "SET_PASSWORD" ? 2 : 3;
  const emailHint = !isEmailFilled
    ? "Enter your email to continue."
    : isCaptchaRequired && !turnstileToken
      ? "Completing the security check…"
      : null;
  const otpHint = otpCode.length !== 6 ? "Enter all 6 digits to continue." : null;

  const progress = <AuthStepper steps={STEPS} current={stepIndex} label="Password reset progress" />;

  let content: React.ReactNode;

  if (step === "SUCCESS") {
    content = (
      <div className="flex flex-col gap-8">
        {progress}
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
          <Link to="/login" search={{ email: email.trim() }}>
            Proceed to Sign In
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  } else if (step === "SET_PASSWORD") {
    content = (
      <div className="flex flex-col gap-8">
        {progress}
        <AuthHeading
          focusOnMount
          title="Set New Password"
          description={
            <>
              Choose a new password for <strong className="font-semibold text-foreground">{maskEmail(email)}</strong>.
            </>
          }
        />

        <AuthError message={serverError} />

        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-6" noValidate>
          <FieldGroup>
            <AuthPasswordField
              id="reset-password"
              label="New password"
              autoComplete="new-password"
              placeholder="Create a new password"
              value={passwordData.password}
              onChange={(e) => {
                setPasswordData((prev) => ({ ...prev, password: e.target.value }));
                if (validationErrors.password) {
                  setValidationErrors((prev) => ({ ...prev, password: "" }));
                }
              }}
              error={validationErrors.password}
              showStrength
              required
            />

            <AuthPasswordField
              id="reset-confirm-password"
              label="Confirm new password"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
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
          </FieldGroup>

          <Button type="submit" size="lg" className="w-full" disabled={resetPasswordMutation.isPending}>
            {resetPasswordMutation.isPending && <Spinner data-icon="inline-start" />}
            Update password
          </Button>
        </form>
      </div>
    );
  } else if (step === "VERIFY_OTP") {
    content = (
      <div className="flex flex-col gap-8">
        {progress}
        <AuthHeading
          title="Enter 6-digit code"
          description={
            <>
              We sent a reset code to <strong className="font-semibold text-foreground">{maskEmail(email)}</strong>.
            </>
          }
        />

        <AuthError message={serverError} />

        <form onSubmit={handleOtpSubmit} className="flex flex-col gap-6" noValidate>
          <OtpCodeField
            id="reset-otp-input"
            label="6-digit verification code"
            value={otpCode}
            autoFocus
            onChange={(val) => {
              setOtpCode(val.replace(/\D/g, "").slice(0, 6));
              if (validationErrors.otp) {
                setValidationErrors({});
              }
            }}
            error={validationErrors.otp}
            hint="The code expires in 10 minutes."
          />

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={otpCode.length !== 6 || verifyOtpMutation.isPending}
              aria-describedby="reset-otp-submit-hint"
            >
              {verifyOtpMutation.isPending && <Spinner data-icon="inline-start" />}
              Verify Code
            </Button>
            <p id="reset-otp-submit-hint" aria-live="polite" className="min-h-5 text-center text-sm text-muted-foreground">
              {otpHint}
            </p>
          </div>
        </form>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          {isEmailLocked ? (
            <Button asChild variant="ghost" size="sm" className="-ml-3">
              <Link to="/login" search={{ email: email.trim() }}>
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                Back to sign in
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-3"
              onClick={() => {
                setStep("EMAIL");
                setServerError(null);
              }}
            >
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Change Email
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mr-3 text-accent hover:text-accent"
            disabled={cooldown > 0 || resendMutation.isPending}
            onClick={handleResend}
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" className={resendMutation.isPending ? "animate-spin" : undefined} />
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </Button>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-8">
        {progress}
        <AuthHeading
          title="Reset your password"
          description={
            isEmailLocked
              ? "We will send a 6-digit code to the email on your account."
              : "Enter the email on your account and we will send a 6-digit code."
          }
        />

        <AuthError message={serverError} />

        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-6" noValidate>
          <FieldGroup>
            <AuthTextField
              id="forgot-email"
              label="Registered email address"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={isEmailLocked ? maskEmail(email) : email}
              readOnly={isEmailLocked}
              onChange={(e) => {
                if (isEmailLocked) return;
                setEmail(e.target.value);
                if (validationErrors.email) {
                  setValidationErrors({});
                }
              }}
              error={validationErrors.email}
              hint={isEmailLocked ? "This email is fixed for this reset." : undefined}
              className={isEmailLocked ? "cursor-not-allowed bg-muted text-muted-foreground" : undefined}
              required
            />

            {!isCaptchaDisabled && (
              <div className="flex flex-col gap-2">
                <FieldLabel>Security verification</FieldLabel>
                <TurnstileWidget
                  ref={turnstileRef}
                  action="forgot_password"
                  onSuccess={(token) => {
                    setTurnstileToken(token);
                    setServerError(null);
                  }}
                  onExpire={() => setTurnstileToken("")}
                />
              </div>
            )}
          </FieldGroup>

          <div className="flex flex-col gap-3">
            <Button type="submit" size="lg" disabled={isSubmitDisabled} aria-describedby="forgot-submit-hint" className="w-full">
              {forgotMutation.isPending && <Spinner data-icon="inline-start" />}
              {forgotMutation.isPending ? "Sending code…" : "Send verification code"}
            </Button>
            <p id="forgot-submit-hint" aria-live="polite" className="min-h-5 text-center text-sm text-muted-foreground">
              {emailHint}
            </p>
          </div>
        </form>

        <p className="border-t border-border pt-6 text-center text-base">
          <Link
            to="/login"
            search={email.trim() ? { email: email.trim() } : undefined}
            className="inline-flex items-center gap-1.5 rounded-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return <AuthStep stepKey={step}>{content}</AuthStep>;
};
