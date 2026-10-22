import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
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
import { ApiError } from "../../lib/api/client";
import { notify, formatErrorMessage } from "../../lib/feedback";
import { maskIdentifier, isPhilippinePhone } from "../../lib/utils";
import { useSecurityControls } from "../../hooks/useSecurityControls";
import { isWithinPasswordByteLimit, PASSWORD_MAX_BYTES, PASSWORD_MAX_BYTES_MESSAGE } from "../../lib/password-strength";

const isEmailOrPhone = (val: string) => {
  const clean = val.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(clean) || isPhilippinePhone(clean);
};

const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Email or mobile number is required")
      .refine(
        isEmailOrPhone,
        "Please enter a valid email address or Philippine mobile number (e.g. 09171234567)"
      ),
    password: z.string().min(8, "Password must be at least 8 characters long").refine(isWithinPasswordByteLimit, PASSWORD_MAX_BYTES_MESSAGE),
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

  const controls = useSecurityControls();
  const otpDisabled = controls.data?.otpDisabled === true && !controls.isError;
  const rateLimitDisabled = controls.data?.rateLimitDisabled === true && !controls.isError;
  const [otpCode, setOtpCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = React.useRef<TurnstileWidgetRef>(null);
  const [step, setStep] = useState<"REGISTER" | "VERIFY_OTP" | "SUCCESS">("REGISTER");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [claimable, setClaimable] = useState(false);
  const [cooldown, setCooldown] = useState(60);

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

  const registerMutation = useMutation({
    mutationFn: (variables: { data: { email: string; password: string }; turnstileToken?: string }) =>
      authApi.register(variables.data, variables.turnstileToken),
    onSuccess: () => {
      setServerError(null);
      setStep("VERIFY_OTP");
      setCooldown(60);
      const isPhone = isPhilippinePhone(formData.email);
      notify.success(
        "Verification code sent",
        isPhone
          ? "Check your mobile phone SMS for the 6-digit code. It may take a few seconds."
          : "Check your inbox for the 6-digit code. It may take a minute."
      );
    },
    onError: (err) => {
      turnstileRef.current?.reset();
      setTurnstileToken("");
      const details = err instanceof ApiError ? (err.details as { code?: string } | undefined) : undefined;
      if (details && !Array.isArray(details) && details.code === "ACCOUNT_CLAIMABLE") {
        setClaimable(true);
        setServerError(null);
        return;
      }
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: authApi.verifyOtp,
    onSuccess: () => {
      setServerError(null);
      setStep("SUCCESS");
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
    },
  });

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

  // Off when the build disables it or the developer-owned DISABLE_CAPTCHA switch is on (Heroku).
  const isCaptchaDisabled =
    import.meta.env.VITE_DISABLE_CAPTCHA === "true" || (controls.data?.captchaDisabled === true && !controls.isError);
  const hasSiteKey = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  const isCaptchaRequired = hasSiteKey && !isCaptchaDisabled && import.meta.env.MODE !== "test";
  const isCredentialsFilled =
    formData.email.trim().length > 0 &&
    formData.password.length > 0 &&
    formData.confirmPassword.length > 0;
  const isSubmitDisabled =
    registerMutation.isPending || !isCredentialsFilled || (isCaptchaRequired && !turnstileToken);

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setClaimable(false);

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

    if (isCaptchaRequired && !turnstileToken) {
      setServerError("Please complete or retry the security verification before creating an account.");
      return;
    }

    registerMutation.mutate({
      data: {
        email: result.data.email,
        password: result.data.password,
      },
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

  const STEPS = ["Account", "Verification", "Ready"];
  const stepIndex = step === "REGISTER" ? 0 : step === "VERIFY_OTP" ? 1 : 2;
  const registerHint = !isCredentialsFilled
    ? "Fill in all three fields to continue."
    : isCaptchaRequired && !turnstileToken
      ? "Completing the security check…"
      : null;

  const progress = <AuthStepper steps={STEPS} current={stepIndex} label="Registration progress" />;

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
            title={isPhilippinePhone(formData.email) ? "Account verified" : "Email verified"}
            description={
              <>
                Your candidate account (<strong className="font-semibold text-foreground">{maskIdentifier(formData.email)}</strong>)
                is active. Sign in to build your profile and apply for open roles.
              </>
            }
          />
        </div>
        <Button asChild size="lg" className="w-full">
          <Link to="/login" search={{ email: formData.email.trim() }}>
            Proceed to sign in
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
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
              We sent a verification code to <strong className="font-semibold text-foreground">{maskIdentifier(formData.email)}</strong>.
              Enter it below to activate your account.
            </>
          }
        />

        <AuthError message={serverError} />

        <form onSubmit={handleOtpSubmit} className="flex flex-col gap-6" noValidate>
          <OtpCodeField
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

          {otpDisabled && (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-300/70 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
              <p>Email/SMS OTP is temporarily disabled for this demo. An unexpired pending challenge is still required.</p>
              <Button
                type="button"
                variant="outline"
                className="self-start"
                disabled={verifyMutation.isPending}
                onClick={() => verifyMutation.mutate({ email: formData.email.trim(), otp: "000000", purpose: "REGISTRATION" })}
              >
                Continue without OTP
              </Button>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={otpCode.length !== 6 || verifyMutation.isPending}>
            {verifyMutation.isPending && <Spinner data-icon="inline-start" />}
            Verify and activate account
          </Button>
        </form>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-3"
            onClick={() => {
              setStep("REGISTER");
              setServerError(null);
            }}
          >
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            {isPhilippinePhone(formData.email) ? "Edit mobile number" : "Edit email"}
          </Button>

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
          title="Create your candidate account"
          description="Search open roles and track every application from review to deployment."
        />

        <AuthError message={serverError} />
        {claimable && (
          <p role="alert" className="rounded-lg border border-border bg-muted p-4 text-base text-foreground">
            A MEGS office already set up an account for this number.{" "}
            <Link to="/claim" className="font-semibold text-accent underline underline-offset-4">
              Set up your account
            </Link>{" "}
            to choose a password.
          </p>
        )}

        <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-6" noValidate>
          <FieldGroup>
            <AuthTextField
              id="register-email"
              label="Email address or mobile number"
              type="text"
              autoComplete="username"
              placeholder="juan.delacruz@gmail.com or 09171234567"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              error={validationErrors.email}
              hint="We'll send a 6-digit code via email or SMS."
              required
            />

            <AuthPasswordField
              id="register-password"
              label="Password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={formData.password}
              maxLength={PASSWORD_MAX_BYTES}
              onChange={(e) => handleChange("password", e.target.value)}
              error={validationErrors.password}
              showStrength
              required
            />

            <AuthPasswordField
              id="register-confirm-password"
              label="Confirm password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              maxLength={PASSWORD_MAX_BYTES}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              error={validationErrors.confirmPassword}
              required
            />

            {!isCaptchaDisabled && (
              <div className="flex flex-col gap-2">
                <FieldLabel>Security verification</FieldLabel>
                <TurnstileWidget
                  ref={turnstileRef}
                  action="signup"
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
            <Button type="submit" size="lg" disabled={isSubmitDisabled} aria-describedby="register-submit-hint" className="w-full">
              {registerMutation.isPending && <Spinner data-icon="inline-start" />}
              {registerMutation.isPending ? "Creating account…" : "Create candidate account"}
            </Button>
            <p id="register-submit-hint" aria-live="polite" className="min-h-5 text-center text-sm text-muted-foreground">
              {registerHint}
            </p>
          </div>
        </form>

        <p className="border-t border-border pt-6 text-center text-base text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="inline-block rounded-sm py-2 font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <AuthStep stepKey={step} order={stepIndex}>
      {content}
    </AuthStep>
  );
};
