import React, { useState } from "react";
import { Dialog, Input, Button } from "../ui";
import { authApi } from "../../lib/api/auth.api";
import { ShieldCheck, KeyRound, AlertCircle, Smartphone } from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";
import type { LoginResponse } from "../../lib/types/auth.types";

interface MfaChallengeModalProps {
  open: boolean;
  onClose: () => void;
  tempToken: string;
  factorId: string;
  challengeId: string;
  email: string;
  onSuccess: (data: LoginResponse) => void;
}

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
      notify.success("MFA Verified", "Secure session initiated.");
      onSuccess(res);
    } catch (err: any) {
      const formatted = formatErrorMessage(err);
      setError(formatted);
      notify.error("Verification Failed", err);
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
      notify.success("Recovery Code Accepted", "Logged in using single-use backup code.");
      onSuccess(res);
    } catch (err: any) {
      const formatted = formatErrorMessage(err);
      setError(formatted);
      notify.error("Recovery Failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Two-Factor Authentication</span>
        </div>
      }
      description={`Security verification required for ${email}`}
      size="sm"
    >
      <div className="space-y-4 pt-1">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {mode === "TOTP" ? (
          <form onSubmit={handleVerifyTotp} className="space-y-4">
            <div className="space-y-1.5 text-center sm:text-left">
              <p className="text-xs text-slate-600 leading-relaxed">
                Open <strong>Microsoft Authenticator</strong> or <strong>Google Authenticator</strong> on your mobile device and enter the 6-digit code for <strong>MEGS Recruitment</strong>.
              </p>
            </div>

            <Input
              label="Authenticator Code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setCode(val);
                if (error) setError(null);
              }}
              className="font-mono tracking-widest text-center text-lg font-bold"
              required
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isLoading}
              leftIcon={<Smartphone className="w-4 h-4" />}
              className="w-full"
            >
              Verify Code
            </Button>

            <div className="pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("RECOVERY");
                }}
                className="text-xs text-teal-700 hover:text-teal-900 font-medium hover:underline inline-flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Lost device? Use emergency backup code</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyRecovery} className="space-y-4">
            <div className="space-y-1.5 text-center sm:text-left">
              <p className="text-xs text-slate-600 leading-relaxed">
                Enter one of your 8-character single-use emergency recovery backup codes (e.g. <code>A1B2-C3D4</code>).
              </p>
            </div>

            <Input
              label="Emergency Recovery Code"
              type="text"
              placeholder="XXXX-XXXX"
              value={recoveryCode}
              onChange={(e) => {
                setRecoveryCode(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              className="font-mono tracking-wider uppercase text-center font-bold"
              required
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isLoading}
              leftIcon={<KeyRound className="w-4 h-4" />}
              className="w-full"
            >
              Verify Recovery Code
            </Button>

            <div className="pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("TOTP");
                }}
                className="text-xs text-teal-700 hover:text-teal-900 font-medium hover:underline inline-flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Return to Authenticator App Code</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
};

