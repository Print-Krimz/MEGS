import React, { useEffect, useId, useState } from "react";
import { cn } from "../../lib/utils";
import { FIELD_LIMITS, getTextareaTextLimit } from "../../lib/field-limits";

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
      maxLength,
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
    const effectiveMaxLength = maxLength ?? getTextareaTextLimit(label, FIELD_LIMITS.notes);
    const initialLength = typeof props.value === "string" ? props.value.length : typeof props.defaultValue === "string" ? props.defaultValue.length : 0;
    const [draftLength, setDraftLength] = useState(initialLength);
    useEffect(() => {
      if (typeof props.value === "string") setDraftLength(props.value.length);
    }, [props.value]);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-slate-700">
            {label}
            {required && <span className="text-rose-700 ml-0.5">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          maxLength={effectiveMaxLength}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            "block w-full rounded-md border text-xs text-slate-900 bg-white placeholder-slate-400 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus:border-focus",
            "p-2.5",
            error
              ? "border-rose-400 text-rose-900 focus-visible:ring-rose-600 focus:border-rose-600 bg-rose-50/20"
              : "border-slate-300 hover:border-slate-400",
            disabled && "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200",
            className
          )}
          {...props}
          onChange={(event) => {
            setDraftLength(event.target.value.length);
            props.onChange?.(event);
          }}
        />

        {effectiveMaxLength > FIELD_LIMITS.notes && (
          <p className="text-[11px] text-slate-500 text-right" aria-label={`${draftLength} of ${effectiveMaxLength} characters used`}>
            {draftLength.toLocaleString()} / {effectiveMaxLength.toLocaleString()}
          </p>
        )}

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
