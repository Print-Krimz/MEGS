import React, { useId } from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id,
      rows = 3,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-slate-700">
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            "block w-full border text-xs text-slate-900 bg-white placeholder-slate-400 transition-colors",
            "focus:outline-none focus:ring-1 focus:ring-teal-700 focus:border-teal-700",
            "p-2.5",
            error
              ? "border-rose-400 text-rose-900 focus:ring-rose-600 focus:border-rose-600 bg-rose-50/20"
              : "border-slate-300 hover:border-slate-400",
            disabled && "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200",
            className
          )}
          {...props}
        />

        {error && (
          <p id={errorId} className="text-xs text-rose-600 font-medium">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
