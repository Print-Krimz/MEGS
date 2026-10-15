import React, { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/shadcn/button";
import { FieldGroup, FieldLabel } from "@/components/shadcn/field";
import { Spinner } from "@/components/shadcn/spinner";
import { AuthPasswordField, AuthTextField } from "../../components/auth/AuthField";
import { AuthError, AuthHeading } from "../../components/auth/AuthChrome";
import { authApi } from "../../lib/api/auth.api";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { notify, formatErrorMessage } from "../../lib/feedback";
import { MfaChallengeModal } from "../../components/auth/MfaChallengeModal";
import { MfaSetupModal } from "../../components/auth/MfaSetupModal";
import { TurnstileWidget, type TurnstileWidgetRef } from "../../components/common";
import type { LoginResponse } from "../../lib/types/auth.types";
import { useSecurityControls } from "../../hooks/useSecurityControls";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string; email?: string };
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: search?.email || "",
    password: "",
  });

  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileTokenRef = React.useRef("");
  const turnstileRef = React.useRef<TurnstileWidgetRef>(null);
  const controls = useSecurityControls();
  const submittingRef = React.useRef(false);

  const [mfaChallenge, setMfaChallenge] = useState<{
    factorId: string;
    challengeId: string;
    tempToken: string;
    email: string;
  } | null>(null);

  const [mfaSetup, setMfaSetup] = useState<{
    tempToken: string;
    email: string;
  } | null>(null);

  React.useEffect(() => {
    if (search?.email && !formData.email) {
      setFormData((prev) => ({ ...prev, email: search.email || "" }));
    }
  }, [search?.email]);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const handleFinalSuccess = (data: LoginResponse) => {
    login(data);
    notify.success("Signed in", "Welcome back.");

    if (data.user.mustChangePassword) {
      navigate({ to: "/change-password" });
      return;
    }

    // Safe internal redirect validation against open redirects and landing page
    if (
      search?.redirect &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("//") &&
      search.redirect !== "/login" &&
      search.redirect !== "/"
    ) {
      navigate({ to: search.redirect as any });
      return;
    }

    if (data.user.role === Role.ADMINISTRATOR) {
      navigate({ to: "/admin" });
    } else if (data.user.role === Role.TALENT_ACQUISITION) {
      navigate({ to: "/ta" });
    } else {
      navigate({ to: "/app" });
    }
  };

  const loginMutation = useMutation({
    mutationFn: (variables: { data: z.infer<typeof loginSchema>; turnstileToken?: string }) =>
      authApi.login(variables.data, variables.turnstileToken),
    onSuccess: (data) => {
      if (data.mfaRequired && data.factorId && data.challengeId && data.tempToken) {
        setMfaChallenge({
          factorId: data.factorId,
          challengeId: data.challengeId,
          tempToken: data.tempToken,
          email: formData.email,
        });
        return;
      }

      if (data.mfaSetupRequired && data.tempToken) {
        setMfaSetup({
          tempToken: data.tempToken,
          email: formData.email,
        });
        return;
      }

      handleFinalSuccess(data);
    },
    onError: (err) => {
      turnstileRef.current?.reset();
      turnstileTokenRef.current = "";
      setTurnstileToken("");
      const formatted = formatErrorMessage(err);
      setServerError(formatted);
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  // Off when the build disables it or the developer-owned DISABLE_CAPTCHA switch is on (Heroku).
  const isCaptchaDisabled =
    import.meta.env.VITE_DISABLE_CAPTCHA === "true" || (controls.data?.captchaDisabled === true && !controls.isError);
  const hasSiteKey = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  const isCaptchaRequired = hasSiteKey && !isCaptchaDisabled && import.meta.env.MODE !== "test";
  const isCredentialsFilled = formData.email.trim().length > 0 && formData.password.length > 0;
  const isSubmitDisabled =
    loginMutation.isPending || !isCredentialsFilled || (isCaptchaRequired && !turnstileToken);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loginMutation.isPending) return;
    setServerError(null);

    const result = loginSchema.safeParse(formData);
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

    const token = turnstileToken || turnstileTokenRef.current;
    if (isCaptchaRequired && !token) {
      setServerError("Please complete or retry the security verification before signing in.");
      return;
    }

    submittingRef.current = true;
    loginMutation.mutate({ data: result.data, turnstileToken: token });
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

  const submitHint = !isCredentialsFilled
    ? "Enter your email and password to continue."
    : isCaptchaRequired && !turnstileToken
      ? "Completing the security check…"
      : null;

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading title="Welcome back" description="Sign in to your MEGS account." />

      <AuthError message={serverError} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <FieldGroup>
          <AuthTextField
            id="login-email"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            error={validationErrors.email}
            required
          />

          <AuthPasswordField
            id="login-password"
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            error={validationErrors.password}
            required
            labelAction={
              <Link
                to="/forgot-password"
                search={formData.email.trim() ? { email: formData.email.trim() } : undefined}
                className="inline-block rounded-sm py-2 text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Forgot password?
              </Link>
            }
          />

          {!isCaptchaDisabled && (
            <div className="flex flex-col gap-2">
              <FieldLabel id="turnstile-label">Security verification</FieldLabel>
              <div
                role="region"
                aria-labelledby="turnstile-label"
                aria-live="polite"
                className="min-h-[65px] w-full max-w-full"
              >
                <TurnstileWidget
                  ref={turnstileRef}
                  action="login"
                  theme="light"
                  size="flexible"
                  onSuccess={(token) => {
                    turnstileTokenRef.current = token;
                    setTurnstileToken(token);
                    setServerError(null);
                  }}
                  onExpire={() => {
                    turnstileTokenRef.current = "";
                    setTurnstileToken("");
                  }}
                  onError={(error) => {
                    if (import.meta.env.DEV) {
                      console.error("[Turnstile error]", error);
                    }
                    turnstileTokenRef.current = "";
                    setTurnstileToken("");
                  }}
                />
              </div>
            </div>
          )}
        </FieldGroup>

        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" disabled={isSubmitDisabled} aria-describedby="login-submit-hint" className="w-full">
            {loginMutation.isPending && <Spinner data-icon="inline-start" />}
            {loginMutation.isPending ? "Signing in…" : "Sign in"}
          </Button>
          <p id="login-submit-hint" aria-live="polite" className="min-h-5 text-center text-sm text-muted-foreground">
            {submitHint}
          </p>
        </div>
      </form>

      <p className="border-t border-border pt-6 text-center text-base text-muted-foreground">
        Don't have an account?{" "}
        <Link
          to="/register"
          className="inline-block rounded-sm py-2 font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Create an account
        </Link>
      </p>

      {/* MFA Challenge Modal */}
      {mfaChallenge && (
        <MfaChallengeModal
          open={!!mfaChallenge}
          onClose={() => setMfaChallenge(null)}
          tempToken={mfaChallenge.tempToken}
          factorId={mfaChallenge.factorId}
          challengeId={mfaChallenge.challengeId}
          email={mfaChallenge.email}
          onSuccess={(data) => {
            setMfaChallenge(null);
            if (data.mfaSetupRequired && data.tempToken) {
              setMfaSetup({ tempToken: data.tempToken, email: mfaChallenge.email });
              return;
            }
            handleFinalSuccess(data);
          }}
        />
      )}

      {/* MFA Setup Modal (First-time Admin/Staff Login) */}
      {mfaSetup && (
        <MfaSetupModal
          open={!!mfaSetup}
          onClose={() => setMfaSetup(null)}
          tempToken={mfaSetup.tempToken}
          email={mfaSetup.email}
          onSuccess={(data) => {
            setMfaSetup(null);
            handleFinalSuccess(data);
          }}
        />
      )}
    </div>
  );
};
