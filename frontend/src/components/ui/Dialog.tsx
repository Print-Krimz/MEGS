import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  bodyClassName?: string;
  overflowVisible?: boolean;
  /** For dialogs that render their own heading instead of `title`. */
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

const restoreFocus = (element: HTMLElement | null) => {
  if (element?.isConnected) element.focus();
};

// Open dialogs, oldest first. Only the last one handles Escape and Tab.
const modalStack: string[] = [];
let scrollLocks = 0;

const lockBodyScroll = () => {
  scrollLocks += 1;
  document.body.style.overflow = "hidden";
};

const unlockBodyScroll = () => {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = "";
};

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  className,
  bodyClassName,
  overflowVisible,
  ariaLabelledBy,
  ariaDescribedBy,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const modalId = useId();

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const wasOpenRef = useRef(false);

  useEffect(() => {
    const getFocusableElements = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => !element.hasAttribute("hidden"));

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only the topmost open dialog owns Escape and focus containment.
      if (!open || modalStack[modalStack.length - 1] !== modalId) return;

      if (e.key === "Escape") {
        onCloseRef.current?.();
      }

      if (e.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;
      if (!dialogRef.current?.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    if (open) {
      modalStack.push(modalId);
      lockBodyScroll();
      window.addEventListener("keydown", handleKeyDown);

      // Only perform initial auto-focus when transitioning from closed to open
      if (!wasOpenRef.current) {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        wasOpenRef.current = true;
        requestAnimationFrame(() => {
          // If focus is already inside dialog, do not steal or jump focus
          // Start on the first form field; with none, focus the dialog itself so the
          // Close button or a destructive action is never the default target. A combobox
          // or file picker opens on focus, so those also leave focus on the dialog.
          if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
            const firstField = getFocusableElements().find((element) =>
              element.matches("input, select, textarea") && (element as HTMLInputElement).type !== "hidden"
            );
            const opensOnFocus = firstField?.matches('[role="combobox"], [type="file"]');
            (firstField && !opensOnFocus ? firstField : dialogRef.current).focus();
          }
        });
      }
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      restoreFocus(previousFocusRef.current);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (open) {
        const index = modalStack.indexOf(modalId);
        if (index !== -1) modalStack.splice(index, 1);
        unlockBodyScroll();
      }
    };
  }, [open, modalId]);

  // Callers that unmount the dialog instead of passing open={false} still get focus back.
  useEffect(() => {
    const previousFocus = previousFocusRef;
    const wasOpen = wasOpenRef;
    return () => {
      if (wasOpen.current) restoreFocus(previousFocus.current);
    };
  }, []);

  if (!open) return null;

  const sizeStyles = {
    sm: "sm:max-w-md",
    md: "sm:max-w-lg",
    lg: "sm:max-w-xl md:max-w-2xl",
    xl: "sm:max-w-3xl md:max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 flex items-center justify-center p-3 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : ariaLabelledBy}
      aria-describedby={description ? descriptionId : ariaDescribedBy}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "relative w-full bg-white border border-slate-400 rounded-md transform transition-all shadow-modal mx-auto focus:outline-none",
          overflowVisible ? "overflow-visible" : "overflow-hidden",
          sizeStyles[size],
          className
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-300 flex items-start justify-between bg-slate-100 gap-2">
            <div className="space-y-0.5 min-w-0">
              {title && (
                <h2 id={titleId} className="text-base font-semibold text-slate-950 break-words">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="text-sm text-slate-600 leading-normal">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label="Close dialog"
              title="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!title && !description && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 min-h-11 min-w-11 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="Close dialog"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Modal Body */}
        <div
          className={cn(
            "px-4 py-3 sm:px-5 sm:py-4",
            overflowVisible ? "overflow-visible" : "max-h-[85vh] overflow-y-auto",
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
