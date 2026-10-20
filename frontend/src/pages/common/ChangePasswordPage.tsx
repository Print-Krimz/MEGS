import React from "react";
import { Button } from "@/components/shadcn/button";
import { FieldGroup } from "@/components/shadcn/field";
import { Spinner } from "@/components/shadcn/spinner";
import { AuthPasswordField } from "../../components/auth/AuthField";
import { AuthError, AuthHeading } from "../../components/auth/AuthChrome";
import { useAuth } from "../../hooks/useAuth";
import { useChangePassword, CHANGE_PASSWORD_COPY } from "../../hooks/useChangePassword";
import { PASSWORD_MAX_BYTES } from "../../lib/password-strength";

export const ChangePasswordPage: React.FC = () => {
  const { mustChangePassword } = useAuth();
  const { values, errors, serverError, isPending, setField, submit, goHome } = useChangePassword({ mode: "redirect" });

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading
        title="Update your password"
        description={
          mustChangePassword
            ? "Your account requires a new password before you can continue."
            : "Choose a strong, unique password to keep your account secure."
        }
      />

      <AuthError message={serverError} />

      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <FieldGroup>
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
            hint="Use at least 8 characters, different from your current password."
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
        </FieldGroup>

        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            {CHANGE_PASSWORD_COPY.submit}
          </Button>
          {!mustChangePassword && (
            <Button type="button" variant="ghost" size="lg" className="w-full text-muted-foreground" onClick={goHome}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
