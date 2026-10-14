import React, { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { FIELD_LIMITS, getInputTextLimit } from "../../lib/field-limits";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  nameInput?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id,
      type = "text",
      nameInput = false,
      maxLength,
      min,
      max,
      step,
      pattern,
      inputMode,
      leftIcon,
      rightIcon,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const inputRef = useRef<HTMLInputElement | null>(null);
    const isNumber = type === "number";
    const inputType = isNumber ? "text" : type;
    const numericPropValue = typeof props.value === "string" ? props.value : String(props.value ?? "");
    const [numericDraft, setNumericDraft] = useState<string | null>(null);
    const lastNumericPropValue = useRef(numericPropValue);
    useEffect(() => {
      if (numericPropValue !== lastNumericPropValue.current) {
        lastNumericPropValue.current = numericPropValue;
        setNumericDraft(null);
      }
    }, [numericPropValue]);
    const rawNumber = numericDraft ?? numericPropValue;
    const stepText = String(step ?? "1");
    const decimalPlaces = stepText === "any" ? 6 : (stepText.split(".")[1]?.length ?? 0);
    const validNumberSyntax = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(rawNumber);
    const numericError = isNumber && (
      (required && rawNumber === "") ||
      (rawNumber !== "" && (
        !validNumberSyntax ||
        (min !== undefined && Number(rawNumber) < Number(min)) ||
        (max !== undefined && Number(rawNumber) > Number(max)) ||
        (rawNumber.split(".")[1]?.length ?? 0) > decimalPlaces
      ))
    );
    const effectiveError = error || (numericError ? "Enter one number within the allowed range and precision." : undefined);
    const defaultMaxLength = type === "date" || isNumber ? undefined : getInputTextLimit(label ?? props.name ?? id, type, FIELD_LIMITS.shortText);
    const defaultMinDate = type === "date" ? "1900-01-01" : undefined;
    const defaultMaxDate = type === "date" ? "2100-12-31" : undefined;
    useEffect(() => {
      if (isNumber) inputRef.current?.setCustomValidity(effectiveError ?? "");
    }, [effectiveError, isNumber]);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={(element) => {
              inputRef.current = element;
              if (typeof ref === "function") ref(element);
              else if (ref) ref.current = element;
            }}
            id={inputId}
            type={inputType}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(effectiveError)}
            aria-describedby={effectiveError ? errorId : helperText ? helperId : undefined}
            inputMode={isNumber ? (decimalPlaces > 0 ? "decimal" : "numeric") : inputMode}
            min={isNumber ? undefined : min ?? defaultMinDate}
            max={isNumber ? undefined : max ?? defaultMaxDate}
            step={isNumber ? undefined : step}
            pattern={isNumber ? "-?(0|[1-9][0-9]*)(\\.[0-9]+)?" : pattern}
            maxLength={maxLength ?? defaultMaxLength}
            className={cn(
              "block w-full min-h-11 md:min-h-10 rounded-md border text-sm text-slate-900 bg-white placeholder-slate-400 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-1 focus:border-[#0B315D]",
              leftIcon ? "pl-8" : "pl-2.5",
              rightIcon ? "pr-8" : "pr-2.5",
              "py-2",
              effectiveError
                ? "border-rose-400 text-rose-900 focus:ring-rose-600 focus:border-rose-600 bg-rose-50/20"
                : "border-slate-300 hover:border-slate-400",
              disabled && "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200",
              className
            )}
            {...props}
            value={isNumber ? numericDraft ?? props.value : props.value}
            onChange={(event) => {
              if (isNumber) {
                const raw = event.target.value;
                setNumericDraft(raw);
                if (raw === "" || /^-?(?:\d+)?(?:\.\d*)?$/.test(raw)) {
                  if (raw === "" || /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) props.onChange?.(event);
                }
                return;
              }

              if (nameInput) {
                const raw = event.target.value;
                const cleaned = raw.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿĀ-žÑñ\s.'’\-]/g, "").replace(/[\r\n\t]+/g, " ");
                if (cleaned !== raw) {
                  event.target.value = cleaned;
                }
                props.onChange?.(event);
                return;
              }

              if (type === "text" || !type) {
                const raw = event.target.value;
                if (/[\r\n\t]/.test(raw)) {
                  event.target.value = raw.replace(/[\r\n\t]+/g, " ");
                }
              }

              props.onChange?.(event);
            }}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>

        {effectiveError && (
          <p id={errorId} className="text-xs text-rose-600 font-medium">
            {effectiveError}
          </p>
        )}

        {!effectiveError && helperText && (
          <p id={helperId} className="text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
