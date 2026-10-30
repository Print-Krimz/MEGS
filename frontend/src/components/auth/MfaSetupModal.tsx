import React, { useState, useEffect } from "react";
import { Check, Copy, Download, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/shadcn/field";
import { Spinner } from "@/components/shadcn/spinner";
import { authApi } from "../../lib/api/auth.api";
import { notify, formatErrorMessage } from "../../lib/feedback";
import type { LoginResponse, MfaEnrollResponse, VerifyMfaEnrollResponse } from "../../lib/types/auth.types";
import { AuthError } from "./AuthChrome";
import { OtpCodeField } from "./OtpCodeField";
import { MfaDisabledContinuation } from "./MfaDisabledContinuation";

interface MfaSetupModalProps {
  open: boolean;
  onClose: () => void;
  tempToken: string;
  email: string;
  onSuccess: (data: LoginResponse) => void;
}

export const MfaSetupModal: React.FC<MfaSetupModalProps> = ({
  open,
  onClose,
  tempToken,
  email,
  onSuccess,
}) => {
  const [step, setStep] = useState<"ENROLL" | "BACKUP">("ENROLL");
  const [enrollData, setEnrollData] = useState<MfaEnrollResponse | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [verifiedSession, setVerifiedSession] = useState<VerifyMfaEnrollResponse | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const enrollingRef = React.useRef(false);

  const fetchEnrollment = React.useCallback(() => {
    if (!tempToken) return;
    setIsLoading(true);
    setError(null);
    authApi
      .enrollMfa(tempToken)
      .then((res) => {
        setEnrollData(res);
      })
      .catch((err) => {
        const formatted = formatErrorMessage(err);
        setError(formatted);
        notify.error("MFA setup error", err);
      })
      .finally(() => {
        setIsLoading(false);
        enrollingRef.current = false;
      });
  }, [tempToken]);

  useEffect(() => {
    if (open && tempToken && !enrollData && !enrollingRef.current) {
      enrollingRef.current = true;
      fetchEnrollment();
    }
  }, [open, tempToken, enrollData, fetchEnrollment]);

  useEffect(() => {
    if (!open) {
      setEnrollData(null);
      setError(null);
      setCode("");
      setStep("ENROLL");
      setShowSecret(false);
      enrollingRef.current = false;
    }
  }, [open]);

  const handleVerifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData) return;
    if (!code.trim() || !/^\d{6}$/.test(code.trim())) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const res = await authApi.verifyMfaEnrollment({
        token: tempToken,
        factorId: enrollData.factorId,
        code: code.trim(),
      });
      setRecoveryCodes(res.recoveryCodes);
      setVerifiedSession(res);
      setStep("BACKUP");
      notify.success("MFA enabled", "Authenticator verified. Please save your recovery backup codes.");
    } catch (err: any) {
      const formatted = formatErrorMessage(err);
      setError(formatted);
    } finally {
      setIsLoading(false);
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
    const text = recoveryCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
    notify.info("Copied", "All recovery backup codes copied to clipboard");
  };

  const handleDownloadRecoveryCodes = () => {
    const text = recoveryCodes.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `megs-mfa-recovery-codes-${email.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify.success("Downloaded", "Backup codes saved as .txt file");
  };

  const handleFinish = () => {
    if (!acknowledged) {
      setError("Please confirm you have saved your recovery codes.");
      return;
    }
    if (verifiedSession) {
      onSuccess({
        access_token: verifiedSession.access_token,
        refresh_token: verifiedSession.refresh_token,
        expires_in: verifiedSession.expires_in,
        user: verifiedSession.user,
      });
    }
  };

  const locked = step === "BACKUP";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !locked) onClose();
      }}
    >
      <DialogContent
        className="theme-megs max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-lg sm:p-8"
        showCloseButton={!locked}
        onInteractOutside={(e) => {
          if (locked) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (locked) e.preventDefault();
        }}
      >
        <DialogHeader className="gap-2 text-left">
          <DialogTitle className="font-display text-2xl leading-tight text-secondary">
            {step === "ENROLL" ? "Set up two-step verification" : "Save your emergency backup codes"}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {step === "ENROLL"
              ? `Scan the QR code with an authenticator app to protect ${email}.`
              : `Each of these ${recoveryCodes.length} codes signs you in once if you lose your authenticator app.`}
          </DialogDescription>
        </DialogHeader>

        <MfaDisabledContinuation token={tempToken} open={open} onSuccess={onSuccess} />

        <AuthError message={error} />

        {step === "ENROLL" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-44 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-2">
                {enrollData?.qrCode ? (
                  <img
                    src={enrollData.qrCode}
                    alt="MFA Enrollment QR Code"
                    className="size-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                    {isLoading ? (
                      <>
                        <Spinner />
                        <span>Generating QR code...</span>
                      </>
                    ) : (
                      <>
                        <span>Unable to load QR code</span>
                        <Button type="button" variant="outline" size="sm" onClick={fetchEnrollment}>
                          Try Again
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {enrollData?.secret && (
                <div className="flex w-full flex-col gap-1.5 rounded-lg border border-border bg-muted p-3">
                  <span className="text-sm text-muted-foreground">Or enter this key manually.</span>
                  <div className="flex items-center justify-between gap-2">
                    <code
                      className="min-w-0 break-all font-mono text-sm font-semibold text-foreground"
                      aria-label={showSecret ? "Manual setup key" : "Manual setup key hidden"}
                    >
                      {showSecret ? enrollData.secret : "•".repeat(enrollData.secret.length)}
                    </code>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSecret((prev) => !prev)}
                        title={showSecret ? "Hide secret key" : "Show secret key"}
                        aria-label={showSecret ? "Hide secret key" : "Show secret key"}
                        aria-pressed={showSecret}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {showSecret ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                        {showSecret ? "Hide" : "Show"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopySecret}
                        title="Copy Secret Key"
                        aria-label="Copy secret key"
                        className="text-accent hover:text-accent"
                      >
                        {copiedSecret ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                        {copiedSecret ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleVerifyEnrollment} className="flex flex-col gap-6" noValidate>
              <FieldGroup className="gap-4">
                <OtpCodeField
                  id="mfa-setup-code"
                  label="Enter the 6-digit code from your app"
                  value={code}
                  onChange={(val) => {
                    setCode(val);
                    if (error) setError(null);
                  }}
                  disabled={isLoading}
                  autoFocus
                />
              </FieldGroup>

              <DialogFooter className="flex-col gap-3 sm:flex-col sm:justify-stretch">
                <Button type="submit" size="lg" disabled={isLoading} className="w-full">
                  {isLoading && enrollData && <Spinner data-icon="inline-start" />}
                  Verify and turn on
                </Button>
              </DialogFooter>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border bg-muted p-4">
                {recoveryCodes.map((rc, idx) => (
                  <li key={idx} className="text-center">
                    <code className="font-mono text-base font-semibold tracking-wider text-foreground">{rc}</code>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCopyRecoveryCodes} className="flex-1">
                  {copiedCodes ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copiedCodes ? "Copied" : "Copy"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadRecoveryCodes} className="flex-1">
                  <Download aria-hidden="true" />
                  Download
                </Button>
              </div>
            </div>

            <Field orientation="horizontal" className="items-start gap-3 rounded-lg border border-border p-4">
              <Checkbox
                id="mfa-recovery-ack"
                checked={acknowledged}
                onCheckedChange={(checked) => {
                  setAcknowledged(checked === true);
                  if (error) setError(null);
                }}
                className="mt-0.5"
              />
              <FieldLabel htmlFor="mfa-recovery-ack" className="text-sm font-normal leading-relaxed text-foreground">
                I have saved or downloaded these {recoveryCodes.length} codes and know they cannot be shown again.
              </FieldLabel>
            </Field>

            <DialogFooter className="flex-col gap-3 sm:flex-col sm:justify-stretch">
              <Button type="button" size="lg" onClick={handleFinish} disabled={!acknowledged} className="w-full">
                Continue to workspace
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
