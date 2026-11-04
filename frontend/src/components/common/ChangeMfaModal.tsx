import React, { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, PasswordInput, Button } from "../ui";
import { MfaSetupModal } from "../auth/MfaSetupModal";
import { OtpCodeField } from "../auth/OtpCodeField";
import { CountdownText, OtpExpiryHint } from "../auth/CountdownText";
import { useOtpTimers } from "../../hooks/useCountdown";
import { useAuth } from "../../hooks/useAuth";
import { getSessionGeneration } from "../../lib/auth/session-generation";
import { authApi } from "../../lib/api/auth.api";
import { formatErrorMessage, notify } from "../../lib/feedback";
import type { LoginResponse } from "../../lib/types/auth.types";

export const ChangeMfaModal: React.FC<{ open: boolean; onClose: () => void; email: string }> = ({ open, onClose, email }) => {
  const [generation] = useState(getSessionGeneration);
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [grant, setGrant] = useState("");
  const [step, setStep] = useState<"password" | "code" | "setup">("password");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const timers = useOtpTimers();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const sendCode = async () => {
    if (!password) { setError("Enter your current password."); return; }
    setPending(true); setError("");
    try { const data = await authApi.requestMfaChangeCode(password); setSentTo(data.sentTo); timers.start(data); setStep("code"); setOtp(""); }
    catch (err) { setError(formatErrorMessage(err)); } finally { setPending(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step === "password") { await sendCode(); return; }
    if (!/^\d{6}$/.test(otp)) { setError("Enter the 6-digit code."); return; }
    setPending(true); setError("");
    try { const data = await authApi.verifyMfaChangeCode(otp); setGrant(data.grant); setPassword(""); setOtp(""); setStep("setup"); }
    catch (err) { setError(formatErrorMessage(err)); } finally { setPending(false); }
  };
  const timed = useCallback((error: unknown) => {
    if (/start again/i.test(formatErrorMessage(error))) { setGrant(""); setStep("password"); setError("This step timed out. Start again."); }
    throw error;
  }, []);
  const enroll = useCallback(() => authApi.enrollMfaChange(grant).catch(timed), [grant, timed]);
  const verify = useCallback((factorId: string, code: string) => authApi.confirmMfaChange({ grant, factorId, code }).catch(timed), [grant, timed]);
  const finish = async (data: LoginResponse) => {
    if (generation !== getSessionGeneration()) return;
    if (data.access_token) localStorage.setItem("access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    window.dispatchEvent(new Event("auth-token-changed"));
    await refreshUser();
    if (generation !== getSessionGeneration()) return;
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    if (data.oldRemoved === false) notify.warning("Your new authenticator works. The old one may still work until you change it again.");
    else notify.success("Authenticator app changed. Your backup codes stay the same.");
    onClose();
  };
  if (step === "setup") return <MfaSetupModal open={open} onClose={onClose} tempToken={localStorage.getItem("access_token") ?? ""} email={email} enroll={enroll} verify={verify} finishLabel="Done" onSuccess={(data) => void finish(data)} />;
  return <Dialog open={open} onClose={onClose} title="Change authenticator app" description={step === "password" ? "Enter your current password." : "Enter the code we sent you."} size="md">
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {step === "password" ? <PasswordInput label="Current password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /> : <div className="space-y-4">
        <p className="text-sm">We sent a code to {sentTo}.</p>
        <OtpCodeField id="mfa-change-otp" label="Verification code" value={otp} onChange={setOtp} hint={<OtpExpiryHint expired={timers.expired} seconds={timers.expiresIn} />} autoFocus compact />
        <p className="text-sm">{timers.cooldown > 0 ? <>Send a new code in <CountdownText seconds={timers.cooldown} /></> : <button type="button" onClick={() => void sendCode()} disabled={pending} className="underline">Send a new code</button>}</p>
      </div>}
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><Button type="button" variant="outline" onClick={step === "code" ? () => setStep("password") : onClose} disabled={pending}>{step === "code" ? "Back" : "Cancel"}</Button><Button type="submit" loading={pending}>{step === "code" ? "Continue" : "Send code"}</Button></div>
    </form>
  </Dialog>;
};
