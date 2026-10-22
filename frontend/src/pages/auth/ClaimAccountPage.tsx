import React, { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { FieldGroup, FieldLabel } from "@/components/shadcn/field";
import { Spinner } from "@/components/shadcn/spinner";
import { AuthPasswordField, AuthTextField } from "../../components/auth/AuthField";
import { AuthError, AuthHeading, AuthStep, AuthStepper } from "../../components/auth/AuthChrome";
import { OtpCodeField } from "../../components/auth/OtpCodeField";
import { TurnstileWidget, type TurnstileWidgetRef } from "../../components/common";
import { publicApi } from "../../lib/api/public.api";
import { formatErrorMessage } from "../../lib/feedback";
import { isPhilippinePhone, maskPhone } from "../../lib/utils";
import { useSecurityControls } from "../../hooks/useSecurityControls";
import { isWithinPasswordByteLimit, PASSWORD_MAX_BYTES, PASSWORD_MAX_BYTES_MESSAGE } from "../../lib/password-strength";

type Step = "PHONE" | "CODE" | "PASSWORD" | "DONE";
const STEPS = ["Mobile number", "SMS code", "Password", "Done"];
const STEP_ORDER: Step[] = ["PHONE", "CODE", "PASSWORD", "DONE"];

const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .refine(isPhilippinePhone, "Enter a Philippine mobile number, for example 09171234567"),
});
const codeSchema = z.object({ otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });
const emailSchema = z.string().trim().email("Enter a valid email address");
const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .refine(isWithinPasswordByteLimit, PASSWORD_MAX_BYTES_MESSAGE),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/** Route: /claim (inside AuthLayout). Walk-in applicants set a password for the account the TA encoded. */
export const ClaimAccountPage: React.FC = () => {
  const controls = useSecurityControls();
  const isCaptchaDisabled =
    import.meta.env.VITE_DISABLE_CAPTCHA === "true" || (controls.data?.captchaDisabled === true && !controls.isError);
  const hasSiteKey = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  const isCaptchaRequired = hasSiteKey && !isCaptchaDisabled && import.meta.env.MODE !== "test";
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const [turnstileToken, setTurnstileToken] = useState("");

  const [step, setStep] = useState<Step>("PHONE");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [claimToken, setClaimToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (step !== "CODE" || cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [step, cooldown]);

  const fail = (err: unknown) => setServerError(formatErrorMessage(err));

  const startMutation = useMutation({
    mutationFn: () => publicApi.claimStart(phone.trim(), turnstileToken || undefined),
    onSuccess: () => {
      setServerError(null);
      setOtp("");
      setCooldown(60);
      // The token is single use; the code step shows a fresh check for "Send a new code".
      turnstileRef.current?.reset();
      setTurnstileToken("");
      setStep("CODE");
    },
    onError: (err) => {
      turnstileRef.current?.reset();
      setTurnstileToken("");
      fail(err);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => publicApi.claimVerify(phone.trim(), otp),
    onSuccess: (res) => {
      setServerError(null);
      setClaimToken(res.claimToken);
      setStep("PASSWORD");
    },
    onError: fail,
  });

  const emailCodeMutation = useMutation({
    mutationFn: () => publicApi.claimEmailCode(claimToken, email.trim()),
    onSuccess: () => {
      setServerError(null);
      setEmailCodeSent(true);
    },
    onError: fail,
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      publicApi.claimComplete({
        claimToken,
        password,
        ...(email.trim() ? { email: email.trim(), emailOtp } : {}),
      }),
    onSuccess: () => {
      setServerError(null);
      setStep("DONE");
    },
    onError: fail,
  });

  const stepIndex = STEP_ORDER.indexOf(step);

  const submitPhone = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const r = phoneSchema.safeParse({ phone });
    if (!r.success) return setErrors({ phone: r.error.issues[0].message });
    if (isCaptchaRequired && !turnstileToken) return setServerError("Complete the security check, then try again.");
    setErrors({});
    startMutation.mutate();
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const r = codeSchema.safeParse({ otp });
    if (!r.success) return setErrors({ otp: r.error.issues[0].message });
    setErrors({});
    verifyMutation.mutate();
  };

  const sendEmailCode = () => {
    setServerError(null);
    const r = emailSchema.safeParse(email);
    if (!r.success) return setErrors({ email: r.error.issues[0].message });
    setErrors({});
    emailCodeMutation.mutate();
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const next: Record<string, string> = {};
    const r = passwordSchema.safeParse({ password, confirmPassword });
    if (!r.success) for (const i of r.error.issues) next[String(i.path[0])] ??= i.message;
    if (email.trim()) {
      if (!emailSchema.safeParse(email).success) next.email = "Enter a valid email address";
      else if (!emailCodeSent) next.email = "Send the code to this email, or clear the field to skip.";
      else if (!/^\d{6}$/.test(emailOtp)) next.emailOtp = "Enter the 6-digit code from your email";
    }
    setErrors(next);
    if (Object.keys(next).length === 0) completeMutation.mutate();
  };

  let content: React.ReactNode;

  if (step === "DONE") {
    content = (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <AuthHeading
            focusOnMount
            title="Your account is ready"
            description="Log in with your mobile number and new password."
          />
        </div>
        <Button asChild size="lg" className="w-full">
          <Link to="/login">
            Go to log in
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  } else if (step === "CODE") {
    content = (
      <form onSubmit={submitCode} className="flex flex-col gap-6" noValidate>
        <AuthHeading
          focusOnMount
          title="Enter the SMS code"
          description={
            <>
              If a MEGS office set up an account for {maskPhone(phone.trim()) || "this number"}, we sent a 6-digit code
              by SMS.
            </>
          }
        />
        <AuthError message={serverError} />
        <OtpCodeField
          label="6-digit code"
          value={otp}
          autoFocus
          onChange={(v) => {
            setOtp(v.replace(/\D/g, "").slice(0, 6));
            setErrors({});
          }}
          error={errors.otp}
          hint="The code expires in 10 minutes."
        />
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {!isCaptchaDisabled && (
            <TurnstileWidget
              ref={turnstileRef}
              action="claim"
              onSuccess={(t) => setTurnstileToken(t)}
              onExpire={() => setTurnstileToken("")}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="self-start"
            disabled={cooldown > 0 || startMutation.isPending || (isCaptchaRequired && !turnstileToken)}
            onClick={() => {
              setServerError(null);
              startMutation.mutate();
            }}
          >
            {startMutation.isPending && <Spinner data-icon="inline-start" />}
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
          </Button>
          {cooldown === 0 && isCaptchaRequired && !turnstileToken && (
            <p className="text-sm text-muted-foreground">Finish the security check to send a new code.</p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => {
              setStep("PHONE");
              setOtp("");
              setServerError(null);
            }}
          >
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Change number
          </Button>
          <Button type="submit" size="lg" disabled={verifyMutation.isPending}>
            {verifyMutation.isPending && <Spinner data-icon="inline-start" />}
            Verify code
          </Button>
        </div>
      </form>
    );
  } else if (step === "PASSWORD") {
    content = (
      <form onSubmit={submitPassword} className="flex flex-col gap-6" noValidate>
        <AuthHeading focusOnMount title="Choose a password" description="You will use it with your mobile number to log in." />
        <AuthError message={serverError} />
        <FieldGroup>
          <AuthPasswordField
            id="claim-password"
            label="Password"
            autoComplete="new-password"
            value={password}
            maxLength={PASSWORD_MAX_BYTES}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            showStrength
            required
          />
          <AuthPasswordField
            id="claim-confirm"
            label="Confirm password"
            autoComplete="new-password"
            value={confirmPassword}
            maxLength={PASSWORD_MAX_BYTES}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            required
          />
          <AuthTextField
            id="claim-email"
            label="Email address (optional)"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailCodeSent(false);
              setEmailOtp("");
            }}
            error={errors.email}
            hint="Add one to get updates by email and reset your password later."
          />
          {email.trim() && (
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="self-start"
                disabled={emailCodeMutation.isPending}
                onClick={sendEmailCode}
              >
                {emailCodeMutation.isPending && <Spinner data-icon="inline-start" />}
                {emailCodeSent ? "Resend email code" : "Send code to email"}
              </Button>
              {emailCodeSent && (
                <OtpCodeField
                  id="claim-email-otp"
                  label="Email code"
                  value={emailOtp}
                  onChange={(v) => setEmailOtp(v.replace(/\D/g, "").slice(0, 6))}
                  error={errors.emailOtp}
                  hint="Check your inbox for the 6-digit code."
                />
              )}
            </div>
          )}
        </FieldGroup>
        <Button type="submit" size="lg" className="w-full" disabled={completeMutation.isPending}>
          {completeMutation.isPending && <Spinner data-icon="inline-start" />}
          Set up my account
        </Button>
      </form>
    );
  } else {
    content = (
      <form onSubmit={submitPhone} className="flex flex-col gap-6" noValidate>
        <AuthHeading
          focusOnMount
          title="Set up your account"
          description="For applicants who applied at a MEGS office. Enter the mobile number you gave the recruiter."
        />
        <AuthError message={serverError} />
        <FieldGroup>
          <AuthTextField
            id="claim-phone"
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09171234567"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setErrors({});
            }}
            error={errors.phone}
            required
          />
          {!isCaptchaDisabled && (
            <div className="flex flex-col gap-2">
              <FieldLabel>Security verification</FieldLabel>
              <TurnstileWidget
                ref={turnstileRef}
                action="claim"
                onSuccess={(t) => {
                  setTurnstileToken(t);
                  setServerError(null);
                }}
                onExpire={() => setTurnstileToken("")}
              />
            </div>
          )}
        </FieldGroup>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={startMutation.isPending}
        >
          {startMutation.isPending && <Spinner data-icon="inline-start" />}
          Send SMS code
        </Button>
        <p className="border-t border-border pt-6 text-center text-base text-muted-foreground">
          Already set up?{" "}
          <Link
            to="/login"
            className="inline-block rounded-sm py-2 font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Log in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthStepper steps={STEPS} current={stepIndex} label="Account setup progress" />
      <AuthStep stepKey={step} order={stepIndex}>
        {content}
      </AuthStep>
    </div>
  );
};

export default ClaimAccountPage;
