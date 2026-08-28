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
}

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
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

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
      if (e.key === "Escape" && open) {
        onCloseRef.current?.();
      }

      if (e.key !== "Tab" || !open) return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);

      // Only perform initial auto-focus when transitioning from closed to open
      if (!wasOpenRef.current) {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        wasOpenRef.current = true;
        requestAnimationFrame(() => {
          // If focus is already inside dialog, do not steal or jump focus
          if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
            const first = getFocusableElements()[0];
            if (first) {
              first.focus();
            } else {
              dialogRef.current.focus();
            }
          }
        });
      }
    } else {
      document.body.style.overflow = "";
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        previousFocusRef.current?.focus();
      }
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  const sizeStyles = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-[calc(100vw-1rem)] bg-white border border-slate-400 transform transition-all shadow-modal",
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
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors shrink-0"
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
            className="absolute top-3 right-3 z-10 p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
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
