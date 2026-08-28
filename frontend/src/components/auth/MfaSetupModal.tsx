import React, { useState, useEffect } from "react";
import { Dialog, Input, Button } from "../ui";
import { authApi } from "../../lib/api/auth.api";
import { ShieldCheck, Copy, Download, Check, AlertCircle, QrCode, Lock } from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";
import type { LoginResponse, MfaEnrollResponse, VerifyMfaEnrollResponse } from "../../lib/types/auth.types";

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
        notify.error("MFA Setup Error", err);
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
      notify.success("MFA Enabled", "Authenticator verified. Please save your recovery backup codes.");
    } catch (err: any) {
      const formatted = formatErrorMessage(err);
      setError(formatted);
      notify.error("Verification Failed", err);
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
    const text = `MEGS Recruitment - Emergency MFA Backup Codes\nAccount: ${email}\nGenerated: ${new Date().toISOString()}\n\n` +
      recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
    notify.info("Copied", "All recovery backup codes copied to clipboard");
  };

  const handleDownloadRecoveryCodes = () => {
    const text = `MEGS Recruitment - Emergency MFA Backup Codes\nAccount: ${email}\nGenerated: ${new Date().toISOString()}\n\n` +
      recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join("\n");
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

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (step !== "BACKUP") onClose();
      }}
      title={
        <div className="flex items-center gap-2 text-slate-900">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>{step === "ENROLL" ? "Set Up Multi-Factor Authentication" : "Save Recovery Codes"}</span>
        </div>
      }
      description={step === "ENROLL" ? `Mandatory security protection for ${email}` : "Keep these single-use codes in a secure location"}
      size="md"
    >
      <div className="space-y-4 pt-1">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {step === "ENROLL" ? (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs text-slate-700">
              <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-teal-600" />
                <span>1. Scan with Microsoft or Google Authenticator</span>
              </p>
              <p className="text-slate-600">
                Open your mobile authenticator app, tap <strong>+ (Add Account)</strong>, and scan the QR code below:
              </p>
            </div>

            {/* QR Code container */}
            <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-lg shadow-inner">
              {enrollData?.qrCode ? (
                <img
                  src={enrollData.qrCode}
                  alt="MFA Enrollment QR Code"
                  className="w-44 h-44 object-contain border border-slate-100 p-2 rounded bg-white shadow-sm"
                />
              ) : (
                <div className="w-44 h-44 flex flex-col items-center justify-center gap-2 bg-slate-100 text-xs text-slate-500 rounded p-3 text-center">
                  {isLoading ? (
                    "Generating QR code..."
                  ) : (
                    <>
                      <span>Unable to load QR code</span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={fetchEnrollment}
                        className="text-xs py-1 px-2.5 h-auto mt-1"
                      >
                        Try Again
                      </Button>
                    </>
                  )}
                </div>
              )}


              {/* Manual Secret Key */}
              {enrollData?.secret && (
                <div className="mt-3 w-full max-w-sm flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                  <div className="truncate">
                    <span className="text-slate-500 mr-1">Key:</span>
                    <code className="font-mono font-bold text-slate-900">{enrollData.secret}</code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="p-1 text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded shrink-0 flex items-center gap-1 text-[11px] font-medium"
                    title="Copy Secret Key"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSecret ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleVerifyEnrollment} className="space-y-4">
              <Input
                label="Enter 6-Digit Code from App"
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
                leftIcon={<Lock className="w-4 h-4" />}
                className="w-full"
              >
                Verify & Enable MFA
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-1.5 text-amber-950">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>Save Your Emergency Backup Codes</span>
              </p>
              <p className="text-amber-800 leading-relaxed">
                If you ever lose access to your authenticator app, each of these 8 codes can be used <strong>once</strong> to sign in to your workspace.
              </p>
            </div>

            {/* Recovery Codes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
              {recoveryCodes.map((rc, idx) => (
                <div key={idx} className="p-2 bg-slate-800/80 rounded border border-slate-700 font-mono text-xs font-bold text-teal-300 tracking-wider">
                  {rc}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopyRecoveryCodes}
                leftIcon={copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                className="flex-1 text-xs"
              >
                {copiedCodes ? "Codes Copied" : "Copy All Codes"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleDownloadRecoveryCodes}
                leftIcon={<Download className="w-3.5 h-3.5" />}
                className="flex-1 text-xs"
              >
                Download (.txt)
              </Button>
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => {
                  setAcknowledged(e.target.checked);
                  if (error) setError(null);
                }}
                className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="leading-relaxed">
                I have securely saved or downloaded these 8 emergency recovery codes and understand they cannot be retrieved again.
              </span>
            </label>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleFinish}
              disabled={!acknowledged}
              className="w-full"
            >
              Continue to Workspace
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
