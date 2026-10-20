import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { authApi } from "../lib/api/auth.api";
import { useAuth } from "./useAuth";
import { Role } from "../lib/types/enums";
import { notify, formatErrorMessage } from "../lib/feedback";
import { isWithinPasswordByteLimit, PASSWORD_MAX_BYTES_MESSAGE } from "../lib/password-strength";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters long")
      .refine(isWithinPasswordByteLimit, PASSWORD_MAX_BYTES_MESSAGE),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

/** Shared field labels so the page and the modal read the same. */
export const CHANGE_PASSWORD_COPY = {
  currentPassword: "Current password",
  newPassword: "New password",
  confirmPassword: "Confirm new password",
  submit: "Update password",
  successTitle: "Password updated",
  successMessage: "Your password has been changed.",
  errorTitle: "Password update failed",
} as const;

export type ChangePasswordField = "currentPassword" | "newPassword" | "confirmPassword";
export type ChangePasswordValues = Record<ChangePasswordField, string>;

const EMPTY_VALUES: ChangePasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

export interface UseChangePasswordOptions {
  /**
   * "redirect": forced or standalone page. After success, refresh the user and go to the role home.
   * "close": modal. After success, refresh the user and call onDone.
   */
  mode: "redirect" | "close";
  /** Called after a successful change (both modes, after any redirect is started). */
  onDone?: () => void;
}

export function roleHomePath(role?: string | null): "/admin" | "/ta" | "/app" {
  if (role === Role.ADMINISTRATOR) return "/admin";
  if (role === Role.TALENT_ACQUISITION) return "/ta";
  return "/app";
}

export function useChangePassword({ mode, onDone }: UseChangePasswordOptions) {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [values, setValues] = useState<ChangePasswordValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<ChangePasswordField, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: async () => {
      await refreshUser();
      notify.success(CHANGE_PASSWORD_COPY.successTitle, CHANGE_PASSWORD_COPY.successMessage);
      if (mode === "redirect") navigate({ to: roleHomePath(user?.role) });
      onDone?.();
    },
    onError: (err) => {
      setServerError(formatErrorMessage(err));
      notify.error(CHANGE_PASSWORD_COPY.errorTitle, err);
    },
  });

  const setField = useCallback((field: ChangePasswordField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /** Clears the form and any error. Modals call this when they close. */
  const reset = useCallback(() => {
    setValues(EMPTY_VALUES);
    setErrors({});
    setServerError(null);
  }, []);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setServerError(null);

    const result = changePasswordSchema.safeParse(values);
    if (!result.success) {
      const next: Partial<Record<ChangePasswordField, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as ChangePasswordField;
        if (!next[field]) next[field] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    mutation.mutate({
      currentPassword: result.data.currentPassword,
      newPassword: result.data.newPassword,
    });
  };

  /** Cancel on the voluntary page: back to the role home. */
  const goHome = () => navigate({ to: roleHomePath(user?.role) });

  return { values, errors, serverError, isPending: mutation.isPending, setField, submit, reset, goHome };
}
