import { createElement, useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useBlocker } from "@tanstack/react-router";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { TA_COPY } from "../lib/ta-copy";

export interface UseDirtyGuardOptions {
  isDirty: boolean;
  /** Dialog body. Defaults to "You have unsaved changes in this form." */
  message?: string;
}

export interface DirtyGuard {
  /**
   * Resolves true when it is safe to discard (form is clean, or the user chose Discard).
   * Call it from Cancel buttons and dialog onClose (Esc / backdrop) before closing a dirty form.
   */
  confirmDiscard: () => Promise<boolean>;
  /** Render this once next to the form. It shows the "Discard your changes?" prompt. */
  discardDialog: ReactElement;
}

/**
 * Guards a form against accidental loss of edits.
 * - Blocks in-app navigation to another page while dirty (router blocker) and asks first.
 * - Adds the browser beforeunload prompt for reload and tab close.
 * - Lets dialogs ask too, through confirmDiscard().
 * Query-string changes on the same page (tabs, filters) are not blocked.
 */
export function useDirtyGuard({ isDirty, message }: UseDirtyGuardOptions): DirtyGuard {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => isDirty && current.pathname !== next.pathname,
    enableBeforeUnload: isDirty,
    withResolver: true,
  });

  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const [askingManually, setAskingManually] = useState(false);

  const settle = useCallback((ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setAskingManually(false);
  }, []);

  // A pending prompt must never leave a promise hanging if the form unmounts.
  useEffect(() => () => resolverRef.current?.(false), []);

  const confirmDiscard = useCallback(() => {
    if (!isDirtyRef.current) return Promise.resolve(true);
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setAskingManually(true);
    });
  }, []);

  const routerBlocked = blocker.status === "blocked";

  const keepEditing = () => {
    if (askingManually) settle(false);
    else if (routerBlocked) blocker.reset?.();
  };
  const discard = () => {
    if (askingManually) settle(true);
    else if (routerBlocked) blocker.proceed?.();
  };

  const discardDialog = createElement(ConfirmDialog, {
    open: askingManually || routerBlocked,
    onClose: keepEditing,
    onConfirm: discard,
    title: TA_COPY.discard.title,
    description: message ?? TA_COPY.discard.description,
    confirmLabel: TA_COPY.discard.discard,
    cancelLabel: TA_COPY.discard.keepEditing,
    variant: "danger",
  });

  return { confirmDiscard, discardDialog };
}
