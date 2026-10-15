import React from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/shadcn/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/shadcn/input-otp";

interface OtpCodeFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/** Six-slot one-time code entry. Numeric only, paste-friendly, autofill-friendly. */
export const OtpCodeField: React.FC<OtpCodeFieldProps> = ({
  id = "otp-input",
  label,
  value,
  onChange,
  error,
  hint,
  autoFocus,
  disabled,
}) => {
  const errorId = `${id}-error`;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputOTP
        id={id}
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        containerClassName="w-full"
      >
        <InputOTPGroup className="w-full justify-between gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot
              key={i}
              index={i}
              data-invalid={error ? true : undefined}
              className="h-14 flex-1 data-[invalid=true]:border-destructive rounded-md border text-xl font-semibold first:rounded-md first:border-l last:rounded-md"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : (
        hint && <FieldDescription>{hint}</FieldDescription>
      )}
    </Field>
  );
};
