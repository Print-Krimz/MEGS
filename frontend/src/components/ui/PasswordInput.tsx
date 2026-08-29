import React, { useState, useId } from "react";
import { cn } from "../../lib/utils";
import { Eye, EyeOff, Check } from "lucide-react";
import { evaluatePasswordStrength } from "../../lib/password-strength";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  showStrengthIndicator?: boolean;
  showToggle?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id,
      leftIcon,
      showStrengthIndicator = false,
      showToggle = true,
      disabled,
      required,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const strengthId = `${inputId}-strength`;

    const [showPassword, setShowPassword] = useState(false);
    const [internalValue, setInternalValue] = useState<string>(
      value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : ""
    );

    // Keep internal tracking updated for controlled inputs
    const currentPassword = value !== undefined ? String(value) : internalValue;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInternalValue(e.target.value);
      if (onChange) {
        onChange(e);
      }
    };

    const strength = evaluatePasswordStrength(currentPassword);

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
            ref={ref}
            id={inputId}
            type={showPassword ? "text" : "password"}
            disabled={disabled}
            value={value}
            defaultValue={defaultValue}
            onChange={handleInputChange}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : showStrengthIndicator ? strengthId : helperText ? helperId : undefined
            }
            className={cn(
              "block w-full min-h-11 md:min-h-10 rounded-md border text-sm text-slate-900 bg-white placeholder-slate-400 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 focus:border-teal-700",
              leftIcon ? "pl-8" : "pl-2.5",
              showToggle ? "pr-10" : "pr-2.5",
              "py-2",
              error
                ? "border-rose-400 text-rose-900 focus:ring-rose-600 focus:border-rose-600 bg-rose-50/20"
                : "border-slate-300 hover:border-slate-400",
              disabled && "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200",
              className
            )}
            {...props}
          />

          {showToggle && (
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
              <button
                type="button"
                tabIndex={0}
                disabled={disabled}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className={cn(
                  "p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1",
                  disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-slate-400"
                )}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p id={errorId} className="text-xs text-rose-600 font-medium">
            {error}
          </p>
        )}

        {/* Helper text (when no error and no strength indicator) */}
        {!error && !showStrengthIndicator && helperText && (
          <p id={helperId} className="text-xs text-slate-500">
            {helperText}
          </p>
        )}

        {/* Real-Time Password Strength Meter & Requirement Checklist */}
        {showStrengthIndicator && (
          <div id={strengthId} className="space-y-2 pt-1">
            {/* Strength Meter Bar & Label */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-medium text-slate-500">Password strength:</span>
                <span className={cn("text-[11px] font-bold font-mono", strength.color)}>
                  {currentPassword.length === 0 ? "Enter password" : strength.level}
                </span>
              </div>
              <div className="flex items-center gap-1.5 h-1.5 w-full" aria-hidden="true">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={cn(
                      "h-full flex-1 rounded-full transition-all duration-300",
                      currentPassword.length > 0 && step <= strength.score
                        ? strength.bgColor
                        : "bg-slate-200"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Requirement Checklist */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-left">
              <ul className="space-y-1" role="list">
                {strength.requirements.map((req) => (
                  <li
                    key={req.id}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] transition-colors leading-tight",
                      req.met ? "text-emerald-700 font-medium" : "text-slate-500"
                    )}
                  >
                    {req.met ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" aria-hidden="true" />
                      </span>
                    )}
                    <span>{req.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
