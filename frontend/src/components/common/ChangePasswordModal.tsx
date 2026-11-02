import React, { useEffect } from "react";
import { Dialog, PasswordInput, Button } from "../ui";
import { KeyRound, AlertCircle, ArrowLeft } from "lucide-react";
import { PASSWORD_MAX_BYTES } from "../../lib/password-strength";
import { CountdownText, OtpExpiryHint } from "../auth/CountdownText";
import { OtpCodeField } from "../auth/OtpCodeField";
import { useChangePassword, CHANGE_PASSWORD_COPY } from "../../hooks/useChangePassword";

export interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, onClose }) => {
  const {
    values, errors, serverError, isPending, setField, submit, reset,
    step, back, resendCode, isSendingCode, codeSentTo, cooldown, expiresIn, expired,
  } = useChangePassword({
    mode: "close",
    onDone: onClose,
  });

  // Clear the form whenever the modal closes.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onCodeStep = step === "code";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Change password"
      description={onCodeStep ? "Step 2 of 2: enter the code we sent you." : "Step 1 of 2: set your new password."}
      size="md"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {serverError && (
          <div role="alert" className="flex items-start gap-2 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span className="leading-relaxed">{serverError}</span>
          </div>
        )}

        {onCodeStep ? (
          <div className="space-y-4">
            <p role="status" className="text-sm text-slate-700">
              We sent a code to <span className="font-medium text-slate-900">{codeSentTo}</span>.
            </p>
            <OtpCodeField
              id="change-otp"
              label={CHANGE_PASSWORD_COPY.otp}
              value={values.otp}
              onChange={(val) => setField("otp", val.replace(/\D/g, "").slice(0, 6))}
              error={errors.otp}
              hint={<OtpExpiryHint expired={expired} seconds={expiresIn} />}
              autoFocus
              compact
            />
            <p className="text-sm text-slate-600">
              Didn&apos;t get it?{" "}
              {cooldown > 0 ? (
                <span>
                  Send a new code in <CountdownText seconds={cooldown} />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={isSendingCode}
                  className="font-medium text-slate-900 underline underline-offset-2 hover:text-slate-700 disabled:opacity-50"
                >
                  {CHANGE_PASSWORD_COPY.resendCode}
                </button>
              )}
            </p>
          </div>
        ) : (
          <>
            <PasswordInput
              label={CHANGE_PASSWORD_COPY.currentPassword}
              autoComplete="current-password"
              placeholder="Enter your current password"
              value={values.currentPassword}
              onChange={(e) => setField("currentPassword", e.target.value)}
              error={errors.currentPassword}
              required
            />

            <PasswordInput
              label={CHANGE_PASSWORD_COPY.newPassword}
              autoComplete="new-password"
              placeholder="Create a new password"
              value={values.newPassword}
              maxLength={PASSWORD_MAX_BYTES}
              onChange={(e) => setField("newPassword", e.target.value)}
              error={errors.newPassword}
              showStrengthIndicator
              required
            />

            <PasswordInput
              label={CHANGE_PASSWORD_COPY.confirmPassword}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={values.confirmPassword}
              maxLength={PASSWORD_MAX_BYTES}
              onChange={(e) => setField("confirmPassword", e.target.value)}
              error={errors.confirmPassword}
              required
            />
          </>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
          {onCodeStep ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={back} disabled={isPending} leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
                {CHANGE_PASSWORD_COPY.back}
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={isPending} leftIcon={<KeyRound className="h-3.5 w-3.5" />}>
                {CHANGE_PASSWORD_COPY.submit}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSendingCode}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={isSendingCode}>
                {CHANGE_PASSWORD_COPY.continue}
              </Button>
            </>
          )}
        </div>
      </form>
    </Dialog>
  );
};
