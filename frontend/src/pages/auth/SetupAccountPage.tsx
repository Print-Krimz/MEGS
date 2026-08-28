import React, { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Input, Button } from "../../components/ui";
import { authApi } from "../../lib/api/auth.api";
import { useAuth } from "../../hooks/useAuth";
import {
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Lock,
  Copy,
  Download,
  Check,
} from "lucide-react";
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

  // STEP 4: Complete Screen
  if (step === "COMPLETE") {
    return (
      <div className="space-y-6 text-center py-2">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Account Fully Activated</h2>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Your MEGS recruiter workspace is secured with Two-Factor Authentication and ready for operational use.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/login">
            <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />} className="w-full">
              Sign In to Workspace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // STEP 3: Backup Codes Screen
  if (step === "BACKUP_CODES") {
    return (
      <div className="space-y-5">
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Step 2 of 2: Save Backup Codes
          </h2>
          <p className="text-xs text-slate-500">
            Emergency single-use recovery codes in case you lose your authenticator device.
          </p>
        </div>

        {serverError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{serverError}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
          {recoveryCodes.map((rc, idx) => (
            <div key={idx} className="p-2 bg-slate-800/80 rounded border border-slate-700 font-mono text-xs font-bold text-teal-300 tracking-wider">
              {rc}
            </div>
          ))}
        </div>

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

        <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => {
              setAcknowledged(e.target.checked);
              if (serverError) setServerError(null);
            }}
            className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="leading-relaxed">
            I have securely saved or downloaded these 8 emergency recovery codes.
          </span>
        </label>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleFinishOnboarding}
          disabled={!acknowledged}
          rightIcon={<ArrowRight className="w-4 h-4" />}
          className="w-full"
        >
          Complete Setup & Enter Workspace
        </Button>
      </div>
    );
  }

  // STEP 2: MFA QR Code Enrollment Screen
  if (step === "MFA_ENROLL") {
    return (
      <div className="space-y-5">
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Step 2 of 2: Configure Authenticator
          </h2>
          <p className="text-xs text-slate-500">
            Scan the QR code with Microsoft Authenticator or Google Authenticator.
          </p>
        </div>

        {serverError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{serverError}</span>
          </div>
        )}

        <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-lg shadow-inner">
          {enrollData?.qrCode ? (
            <img
              src={enrollData.qrCode}
              alt="MFA QR Code"
              className="w-40 h-40 object-contain border border-slate-100 p-2 rounded bg-white shadow-sm"
            />
          ) : (
            <div className="w-40 h-40 flex items-center justify-center bg-slate-100 text-xs text-slate-500 rounded">
              {isMfaLoading ? "Generating QR code..." : "Loading QR code..."}
            </div>
          )}

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
              >
                {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSecret ? "Copied" : "Copy"}</span>
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleVerifyMfa} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Enter 6-Digit Code from App <span className="text-rose-500">*</span>
            </label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="123456"
              value={totpCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setTotpCode(val);
                if (serverError) setServerError(null);
              }}
              className="font-mono tracking-widest text-center text-lg font-bold"
              required
              autoFocus
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isMfaLoading}
            leftIcon={<Lock className="w-4 h-4" />}
            className="w-full"
          >
            Verify & Continue
          </Button>
        </form>
      </div>
    );
  }

  // STEP 1: Set Password Form
  if (tokenLoading) {
    return (
      <div className="space-y-4 py-8 text-center">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
        <p className="text-xs text-slate-500 font-mono">Verifying invitation credentials...</p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="space-y-6">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-xs text-rose-900">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-rose-950 font-sans text-sm">Invitation Invalid or Expired</h3>
            <p className="leading-relaxed">{tokenError}</p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-2">
          <p className="font-medium text-slate-900">Need a new invitation?</p>
          <p>
            Please contact your system administrator to request a new single-use invitation link.
          </p>
        </div>

        <Link
          to="/login"
          className="inline-flex items-center justify-center w-full px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
        >
          Return to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1 text-center sm:text-left">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
          Step 1 of 2: Set Password
        </h2>
        <p className="text-xs text-slate-500">
          Create your password to begin securing your recruiter workspace.
        </p>
      </div>

      {/* Locked Masked Email Card */}
      {invitationDetails?.maskedEmail && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider font-mono">
              Invited Email (Locked)
            </span>
            <div className="font-mono text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>{invitationDetails.maskedEmail}</span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 rounded">
            TA SPECIALIST
          </span>
        </div>
      )}

      {/* Global Server Error Banner */}
      {serverError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{serverError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
        {!routeToken && (
          <Input
            label="Invitation Token"
            type="text"
            placeholder="Paste your invitation token"
            value={formData.token}
            onChange={(e) => handleChange("token", e.target.value)}
            error={validationErrors.token}
            required
          />
        )}

        <Input
          label="Set Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={(e) => handleChange("password", e.target.value)}
          error={validationErrors.password}
          helperText="Minimum 8 characters"
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
          loading={setupMutation.isPending}
          rightIcon={<ArrowRight className="w-4 h-4" />}
          className="w-full mt-2"
        >
          Continue to Step 2
        </Button>
      </form>
    </div>
  );
};

