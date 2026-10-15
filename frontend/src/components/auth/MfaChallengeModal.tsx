import React, { useState } from "react";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { FieldGroup } from "@/components/shadcn/field";
import { Spinner } from "@/components/shadcn/spinner";
import { authApi } from "../../lib/api/auth.api";
import { notify, formatErrorMessage } from "../../lib/feedback";
import type { LoginResponse } from "../../lib/types/auth.types";
import { AuthError } from "./AuthChrome";
import { AuthTextField } from "./AuthField";
import { OtpCodeField } from "./OtpCodeField";
import { MfaDisabledContinuation } from "./MfaDisabledContinuation";

interface MfaChallengeModalProps {
  open: boolean;
  onClose: () => void;
  tempToken: string;
  factorId: string;
  challengeId: string;
  email: string;
  onSuccess: (data: LoginResponse) => void;
}

const TOGGLE_CLASS = "w-full text-accent hover:text-accent";

export const MfaChallengeModal: React.FC<MfaChallengeModalProps> = ({
  open,
  onClose,
  tempToken,
  factorId,
  challengeId,
  email,
  onSuccess,
}) => {
  const [mode, setMode] = useState<"TOTP" | "RECOVERY">("TOTP");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !/^\d{6}$/.test(code.trim())) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const res = await authApi.verifyMfaLogin({
        token: tempToken,
        factorId,
        challengeId,
        code: code.trim(),
      });
      notify.success("MFA verified", "Secure session initiated.");
      onSuccess(res);
    } catch (err: any) {
      const formatted = formatErrorMessage(err);
      setError(formatted);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setError("Please enter an emergency recovery backup code.");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const res = await authApi.verifyMfaRecovery({
        token: tempToken,
        recoveryCode: recoveryCode.trim(),
      });
      notify.success("Recovery code accepted", "Logged in using single-use backup code.");
      onSuccess(res);
    } catch (err: any) {
      const formatted = formatErrorMessage(err);
      setError(formatted);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="theme-megs max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-md sm:p-8"
        showCloseButton
      >
        <DialogHeader className="gap-2 text-left">
          <DialogTitle className="font-display text-2xl leading-tight text-secondary">
            Two-step verification
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {`Security verification required for ${email}`}
          </DialogDescription>
        </DialogHeader>

        <MfaDisabledContinuation token={tempToken} open={open} onSuccess={onSuccess} />

        <AuthError message={error} />

        {mode === "TOTP" ? (
          <form onSubmit={handleVerifyTotp} className="flex flex-col gap-6" noValidate>
            <FieldGroup className="gap-4">
              <OtpCodeField
                id="mfa-challenge-code"
                label="Authenticator code"
                hint="Enter the 6-digit code for MEGS Recruitment from your authenticator app."
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
                {isLoading && <Spinner data-icon="inline-start" />}
                Verify code
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={TOGGLE_CLASS}
                onClick={() => {
                  setError(null);
                  setMode("RECOVERY");
                }}
              >
                Lost device? Use emergency backup code
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyRecovery} className="flex flex-col gap-6" noValidate>
            <FieldGroup className="gap-4">
              <AuthTextField
                id="mfa-recovery-code"
                label="Emergency recovery code"
                hint="Use one of the 8-character codes you saved during setup. Each code works once."
                type="text"
                placeholder="XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={recoveryCode}
                onChange={(e) => {
                  setRecoveryCode(e.target.value.toUpperCase());
                  if (error) setError(null);
                }}
                disabled={isLoading}
                className="h-12 text-center font-mono text-lg uppercase tracking-wider"
                autoFocus
              />
            </FieldGroup>

            <DialogFooter className="flex-col gap-3 sm:flex-col sm:justify-stretch">
              <Button type="submit" size="lg" disabled={isLoading} className="w-full">
                {isLoading && <Spinner data-icon="inline-start" />}
                Verify recovery code
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={TOGGLE_CLASS}
                onClick={() => {
                  setError(null);
                  setMode("TOTP");
                }}
              >
                Use authenticator app code instead
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
