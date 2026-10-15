import React, { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { FieldGroup } from "@/components/shadcn/field";
import { Spinner } from "@/components/shadcn/spinner";
import { AuthPasswordField, AuthTextField } from "../../components/auth/AuthField";
import { AuthError, AuthHeading, AuthStep, AuthStepper } from "../../components/auth/AuthChrome";
import { OtpCodeField } from "../../components/auth/OtpCodeField";
import { authApi } from "../../lib/api/auth.api";
import { useAuth } from "../../hooks/useAuth";
import { CheckCircle2, ArrowRight, Lock, Copy, Download, Check } from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";

import type { MfaEnrollResponse, VerifyMfaEnrollResponse, InvitationDetailsResponse } from "../../lib/types/auth.types";

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
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { token?: string };
  const routeToken = params?.token || "";
  const { login } = useAuth();

  const [step, setStep] = useState<"PASSWORD" | "MFA_ENROLL" | "BACKUP_CODES" | "COMPLETE">("PASSWORD");

  const [formData, setFormData] = useState({
    token: routeToken,
    password: "",
    confirmPassword: "",
  });

  const [invitationDetails, setInvitationDetails] = useState<InvitationDetailsResponse | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [tempAuthToken, setTempAuthToken] = useState<string | null>(null);
  const [enrollData, setEnrollData] = useState<MfaEnrollResponse | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [verifiedSession, setVerifiedSession] = useState<VerifyMfaEnrollResponse | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isMfaLoading, setIsMfaLoading] = useState(false);

  // Proactively isolate invitation setup from any lingering session
  React.useEffect(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }, []);

  // Fetch invitation details if token is present
  React.useEffect(() => {
    const activeToken = formData.token || routeToken;
    if (activeToken && activeToken.trim()) {
      setTokenLoading(true);
      setTokenError(null);
      authApi
        .getInvitationDetails(activeToken.trim())
        .then((res) => {
          setInvitationDetails(res);
          setTokenError(null);
        })
        .catch((err) => {
          const msg = formatErrorMessage(err) || "This invitation link is invalid or has expired.";
          setTokenError(msg);
        })
        .finally(() => {
          setTokenLoading(false);
        });
    }
  }, [formData.token, routeToken]);

  const setupMutation = useMutation({
    mutationFn: authApi.setupAccount,
    onSuccess: async (data) => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      notify.success("Password Set", "Proceeding to security authenticator configuration.");
      if (data.tempToken) {
        setTempAuthToken(data.tempToken);
        setStep("MFA_ENROLL");
        // Start MFA enrollment with isolated TA temporary token
        setIsMfaLoading(true);
        try {
          const mfaRes = await authApi.enrollMfa(data.tempToken);
          setEnrollData(mfaRes);
        } catch (err: any) {
          const formatted = formatErrorMessage(err);
          setServerError(formatted);
          notify.error("MFA Enrollment Error", err);
        } finally {
          setIsMfaLoading(false);
        }
      } else {
        setStep("COMPLETE");
      }
    },
    onError: (err) => {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
      notify.error("Activation Failed", err);
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
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

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData || !tempAuthToken) return;
    if (!totpCode.trim() || !/^\d{6}$/.test(totpCode.trim())) {
      setServerError("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setServerError(null);
    setIsMfaLoading(true);
    try {
      const res = await authApi.verifyMfaEnrollment({
        token: tempAuthToken,
        factorId: enrollData.factorId,
        code: totpCode.trim(),
      });
      setRecoveryCodes(res.recoveryCodes);
      setVerifiedSession(res);
      setStep("BACKUP_CODES");
      notify.success("MFA Verified", "Please safely store your recovery backup codes.");
    } catch (err: any) {
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
      notify.error("Verification Failed", err);
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (enrollData?.secret) {
      navigator.clipboard.writeText(enrollData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
      notify.info("Copied", "Secret key copied to clipboard");
    }
  };

  const handleCopyRecoveryCodes = () => {
    const text = `MEGS Recruitment - Emergency MFA Backup Codes\nGenerated: ${new Date().toISOString()}\n\n` +
      recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
    notify.info("Copied", "All recovery codes copied to clipboard");
  };

  const handleDownloadRecoveryCodes = () => {
    const text = `MEGS Recruitment - Emergency MFA Backup Codes\nGenerated: ${new Date().toISOString()}\n\n` +
      recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `megs-mfa-recovery-codes.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify.success("Downloaded", "Backup codes saved as .txt file");
  };

  const handleFinishOnboarding = () => {
    if (!acknowledged) {
      setServerError("Please acknowledge that you have saved your emergency recovery codes.");
      return;
    }
    if (verifiedSession) {
      login({
        access_token: verifiedSession.access_token,
        refresh_token: verifiedSession.refresh_token,
        expires_in: verifiedSession.expires_in,
        user: verifiedSession.user,
      });
      navigate({ to: "/ta" });
    } else {
      setStep("COMPLETE");
    }
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

  const STEPS = ["Set password", "Authenticator"];
  const stepIndex = step === "PASSWORD" ? 0 : step === "COMPLETE" ? 2 : 1;
  const progress = <AuthStepper steps={STEPS} current={stepIndex} label="Account setup progress" />;

  let content: React.ReactNode;

  if (step === "COMPLETE") {
    content = (
      <div className="flex flex-col gap-8">
        {progress}
        <div className="flex flex-col gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <AuthHeading
            focusOnMount
            title="Account activated"
            description="Your recruiter workspace is protected with two-factor authentication. Sign in to get started."
          />
        </div>
        <Button asChild size="lg" className="w-full">
          <Link to="/login">
            Sign in to workspace
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  } else if (step === "BACKUP_CODES") {
    content = (
      <div className="flex flex-col gap-8">
        {progress}
        <AuthHeading
          focusOnMount
          title="Save your backup codes"
          description="Each code works once. Use one to sign in if you lose access to your authenticator."
        />

        <AuthError message={serverError} />

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted p-3 sm:grid-cols-4">
          {recoveryCodes.map((rc, idx) => (
            <div
              key={idx}
              className="rounded-md border border-border bg-background px-2 py-2 text-center font-mono text-sm font-semibold text-foreground"
            >
              {rc}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={handleCopyRecoveryCodes}>
            {copiedCodes ? (
              <Check data-icon="inline-start" className="text-success" aria-hidden="true" />
            ) : (
              <Copy data-icon="inline-start" aria-hidden="true" />
            )}
            {copiedCodes ? "Codes copied" : "Copy all codes"}
          </Button>

          <Button type="button" variant="outline" className="flex-1" onClick={handleDownloadRecoveryCodes}>
            <Download data-icon="inline-start" aria-hidden="true" />
            Download (.txt)
          </Button>
        </div>

        <label
          htmlFor="setup-acknowledged"
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted p-4 text-sm leading-relaxed text-foreground"
        >
          <Checkbox
            id="setup-acknowledged"
            checked={acknowledged}
            onCheckedChange={(checked) => {
              setAcknowledged(checked === true);
              if (serverError) setServerError(null);
            }}
            className="mt-0.5"
          />
          <span>I have saved or downloaded these {recoveryCodes.length} recovery codes.</span>
        </label>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={handleFinishOnboarding}
            disabled={!acknowledged}
            aria-describedby="setup-finish-hint"
          >
            Finish and open workspace
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
          <p id="setup-finish-hint" aria-live="polite" className="min-h-5 text-center text-sm text-muted-foreground">
            {acknowledged ? null : "Confirm you saved your codes to continue."}
          </p>
        </div>
      </div>
    );
  } else if (step === "MFA_ENROLL") {
    content = (
      <div className="flex flex-col gap-8">
        {progress}
        <AuthHeading
          focusOnMount
          title="Set up your authenticator"
          description="Scan the QR code with Microsoft Authenticator or Google Authenticator, then enter the code it shows."
        />

        <AuthError message={serverError} />

        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted p-4">
          {enrollData?.qrCode ? (
            <img
              src={enrollData.qrCode}
              alt="MFA QR Code"
              className="size-40 rounded-md border border-border bg-white object-contain p-2"
            />
          ) : (
            <div className="flex size-40 items-center justify-center gap-2 rounded-md border border-border bg-background text-sm text-muted-foreground">
              <Spinner />
              <span>{isMfaLoading ? "Generating QR code…" : "Loading QR code…"}</span>
            </div>
          )}

          {enrollData?.secret && (
            <div className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background py-1 pl-3 pr-1 text-sm">
              <div className="truncate">
                <span className="mr-1 text-muted-foreground">Key:</span>
                <code className="font-mono font-semibold text-foreground">{enrollData.secret}</code>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-accent hover:text-accent" onClick={handleCopySecret}>
                {copiedSecret ? (
                  <Check data-icon="inline-start" className="text-success" aria-hidden="true" />
                ) : (
                  <Copy data-icon="inline-start" aria-hidden="true" />
                )}
                {copiedSecret ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
        </div>

        <form onSubmit={handleVerifyMfa} className="flex flex-col gap-6" noValidate>
          <OtpCodeField
            id="setup-totp"
            label="6-digit code from your app"
            value={totpCode}
            autoFocus
            onChange={(val) => {
              setTotpCode(val.replace(/\D/g, "").slice(0, 6));
              if (serverError) setServerError(null);
            }}
          />

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={totpCode.length !== 6 || isMfaLoading}
              aria-describedby="setup-totp-hint"
            >
              {isMfaLoading && <Spinner data-icon="inline-start" />}
              {isMfaLoading ? "Verifying…" : "Verify and continue"}
            </Button>
            <p id="setup-totp-hint" aria-live="polite" className="min-h-5 text-center text-sm text-muted-foreground">
              {totpCode.length !== 6 ? "Enter all six digits to continue." : null}
            </p>
          </div>
        </form>
      </div>
    );
  } else if (tokenLoading) {
    content = (
      <div className="flex flex-col gap-8">
        {progress}
        <div className="flex items-center gap-3 text-base text-muted-foreground" aria-live="polite">
          <Spinner />
          <span>Verifying your invitation…</span>
        </div>
      </div>
    );
  } else if (tokenError) {
    content = (
      <div className="flex flex-col gap-8">
        <AuthHeading focusOnMount title="Invitation invalid or expired" />

        <AuthError message={tokenError} />

        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Need a new invitation?</p>
          <p>Ask your system administrator for a new single-use invitation link.</p>
        </div>

        <Button asChild variant="outline" size="lg" className="w-full">
          <Link to="/login">Return to sign in</Link>
        </Button>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-8">
        {progress}
        <AuthHeading
          title="Set your password"
          description="Create a password to secure your recruiter workspace."
        />

        {invitationDetails?.maskedEmail && (
          <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-muted p-4">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-3.5 shrink-0" aria-hidden="true" />
              Invited email (locked)
            </span>
            <span className="break-all text-base font-semibold text-foreground">
              {invitationDetails.maskedEmail}
            </span>
          </div>
        )}

        <AuthError message={serverError} />

        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-6" noValidate>
          <FieldGroup>
            {!routeToken && (
              <AuthTextField
                id="setup-token"
                label="Invitation token"
                type="text"
                placeholder="Paste your invitation token"
                value={formData.token}
                onChange={(e) => handleChange("token", e.target.value)}
                error={validationErrors.token}
                required
              />
            )}

            <AuthPasswordField
              id="setup-password"
              label="Set password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              error={validationErrors.password}
              showStrength
              required
            />

            <AuthPasswordField
              id="setup-confirm-password"
              label="Confirm password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              error={validationErrors.confirmPassword}
              required
            />
          </FieldGroup>

          <Button type="submit" size="lg" className="w-full" disabled={setupMutation.isPending}>
            {setupMutation.isPending && <Spinner data-icon="inline-start" />}
            {setupMutation.isPending ? "Setting password…" : "Continue to Step 2"}
            {!setupMutation.isPending && <ArrowRight data-icon="inline-end" aria-hidden="true" />}
          </Button>
        </form>
      </div>
    );
  }

  return <AuthStep stepKey={step}>{content}</AuthStep>;
};
