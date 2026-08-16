import React, { useEffect, useRef } from "react";
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
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  className,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeStyles = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full bg-white border border-slate-400 overflow-hidden transform transition-all shadow-modal",
          sizeStyles[size],
          className
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-5 py-3.5 border-b border-slate-300 flex items-start justify-between bg-slate-100">
            <div className="space-y-0.5">
              {title && (
                <h2 className="text-sm font-bold text-slate-950 font-mono uppercase tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-slate-600 font-sans">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
              title="Close modal"
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
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Modal Body */}
        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
