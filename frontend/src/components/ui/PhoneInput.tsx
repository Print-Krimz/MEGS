import React, { useId } from "react";
import { Phone, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  formatPhilippineMobileDisplay,
  formatPhilippinePhoneDisplay,
  validatePhilippineMobile,
  validatePhilippinePhone,
} from "../../lib/phone-utils";

export interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  mobileOnly?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  label = "Contact Phone",
  value,
  onChange,
  placeholder = "0917 123 4567",
  error: customError,
  helperText,
  required,
  disabled,
  className,
  id: customId,
  mobileOnly = false,
}) => {
  const generatedId = useId();
  const inputId = customId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  // Real-time analysis
  const validation = React.useMemo(
    () => mobileOnly ? validatePhilippineMobile(value) : validatePhilippinePhone(value),
    [mobileOnly, value]
  );
  const activeError = customError || (value && !validation.isValid ? validation.message : undefined);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (mobileOnly) {
      let digits = raw.replace(/\D/g, "");
      if (digits.startsWith("63") && digits.length > 2) {
        digits = digits.slice(2);
        if (digits.startsWith("9")) digits = `0${digits}`;
      } else if (digits.startsWith("9")) {
        digits = `0${digits}`;
      } else if (digits.length > 0 && !digits.startsWith("0")) {
        digits = `09${digits}`;
      } else if (digits.startsWith("0") && digits.length > 1 && digits[1] !== "9") {
        digits = `09${digits.slice(1)}`;
      }
      digits = digits.slice(0, 11);
      if (!digits) {
        onChange("");
        return;
      }
      const formatted = formatPhilippineMobileDisplay(digits);
      onChange(formatted);
      return;
    }

    const hasPlus = raw.trim().startsWith("+");
    const digitsOnly = raw.replace(/\D/g, "").slice(0, 12);
    if (!digitsOnly) {
      onChange("");
      return;
    }
    const cleanRaw = hasPlus ? `+${digitsOnly}` : digitsOnly;
    const formatted = formatPhilippinePhoneDisplay(cleanRaw);
    onChange(formatted);
  };

  return (
    <div className={cn("w-full space-y-1.5 text-left", className)}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-rose-700 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative rounded-md shadow-xs">
        {/* Input */}
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          maxLength={16}
          aria-invalid={Boolean(activeError)}
          aria-describedby={activeError ? errorId : helperText ? helperId : undefined}
          className={cn(
            "block w-full min-h-11 md:min-h-10 rounded-md border text-sm text-slate-900 bg-white placeholder-slate-400 font-mono transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus:border-focus",
            "pl-3 pr-9 py-2",
            activeError
              ? "border-rose-400 text-rose-900 focus:ring-rose-600 focus:border-rose-600 bg-rose-50/20"
              : "border-slate-300 hover:border-slate-400",
            disabled && "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
          )}
        />

        {/* Status icon */}
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
          {activeError ? (
            <AlertCircle
              className="w-4 h-4 text-rose-500 animate-fade-in"
              aria-label="Invalid Phone Format"
            />
          ) : (
            <Phone className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {activeError && (
        <p id={errorId} className="text-xs text-rose-600 font-medium animate-fade-in">
          {activeError}
        </p>
      )}

      {!activeError && helperText && (
        <p id={helperId} className="text-xs text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
};
