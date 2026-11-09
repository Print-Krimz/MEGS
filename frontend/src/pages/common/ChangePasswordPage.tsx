import React from "react";
import { Button } from "@/components/shadcn/button";
import { FieldGroup } from "@/components/shadcn/field";
import { Spinner } from "@/components/shadcn/spinner";
import { AuthPasswordField } from "../../components/auth/AuthField";
import { AuthError, AuthHeading } from "../../components/auth/AuthChrome";
import { useAuth } from "../../hooks/useAuth";
import { CountdownText, OtpExpiryHint } from "../../components/auth/CountdownText";
import { OtpCodeField } from "../../components/auth/OtpCodeField";
import { useChangePassword, CHANGE_PASSWORD_COPY } from "../../hooks/useChangePassword";
import { PASSWORD_MAX_BYTES } from "../../lib/password-strength";

export const ChangePasswordPage: React.FC = () => {
  const { mustChangePassword } = useAuth();
  const {
    values, errors, serverError, isPending, setField, submit, goHome,
    step, back, resendCode, isSendingCode, codeSentTo, cooldown, expiresIn, expired,
  } = useChangePassword({ mode: "redirect" });
  const onCodeStep = step === "code";

  return (
    <div className="flex flex-col gap-8">
      <title>Change password | MEGS</title>
      <AuthHeading
        title={onCodeStep ? "Enter your code" : "Change password"}
        focusOnMount={onCodeStep}
        description={
          onCodeStep
            ? "Step 2 of 2: enter the code we sent you."
            : mustChangePassword
              ? "Step 1 of 2: your account needs a new password before you can continue."
              : "Step 1 of 2: set your new password."
        }
      />

      <AuthError message={serverError} />

      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <FieldGroup>
          {onCodeStep ? (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                We sent a code to <span className="font-medium text-foreground">{codeSentTo}</span>.
              </p>
              <OtpCodeField
                id="change-otp"
                label={CHANGE_PASSWORD_COPY.otp}
                value={values.otp}
                onChange={(val) => setField("otp", val.replace(/\D/g, "").slice(0, 6))}
                error={errors.otp}
                hint={<OtpExpiryHint expired={expired} seconds={expiresIn} />}
                autoFocus
              />
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="lg" className="flex-1" onClick={resendCode} disabled={isSendingCode || cooldown > 0}>
                  {isSendingCode && <Spinner data-icon="inline-start" />}
                  {CHANGE_PASSWORD_COPY.resendCode}
                </Button>
                {cooldown > 0 && (
                  <span className="text-sm text-muted-foreground">
                    <CountdownText seconds={cooldown} />
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <AuthPasswordField
                id="change-current-password"
                label={CHANGE_PASSWORD_COPY.currentPassword}
                autoComplete="current-password"
                placeholder="Enter your current password"
                value={values.currentPassword}
                onChange={(e) => setField("currentPassword", e.target.value)}
                error={errors.currentPassword}
                required
              />

              <AuthPasswordField
                id="change-new-password"
                label={CHANGE_PASSWORD_COPY.newPassword}
                autoComplete="new-password"
                placeholder="Create a new password"
                value={values.newPassword}
                maxLength={PASSWORD_MAX_BYTES}
                onChange={(e) => setField("newPassword", e.target.value)}
                error={errors.newPassword}
                hint="Use at least 8 characters with a letter and a number, different from your current password."
                showStrength
                required
              />

              <AuthPasswordField
                id="change-confirm-password"
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
        </FieldGroup>

        <div className="flex flex-col gap-3">
          {onCodeStep ? (
            <>
              <Button type="submit" size="lg" className="w-full" disabled={isPending}>
                {isPending && <Spinner data-icon="inline-start" />}
                {CHANGE_PASSWORD_COPY.submit}
              </Button>
              <Button type="button" variant="ghost" size="lg" className="w-full text-muted-foreground" onClick={back} disabled={isPending}>
                {CHANGE_PASSWORD_COPY.back}
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" size="lg" className="w-full" disabled={isSendingCode}>
                {isSendingCode && <Spinner data-icon="inline-start" />}
                {CHANGE_PASSWORD_COPY.continue}
              </Button>
              {!mustChangePassword && (
                <Button type="button" variant="ghost" size="lg" className="w-full text-muted-foreground" onClick={goHome}>
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  );
};
