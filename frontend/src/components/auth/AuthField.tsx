import React, { useId } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/shadcn/field";
import { Input } from "@/components/shadcn/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/shadcn/input-group";
import { evaluatePasswordStrength } from "../../lib/password-strength";
import { cn } from "../../lib/shadcn-utils";

interface BaseProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Rendered on the label row, right aligned (for example a "Forgot password?" link). */
  labelAction?: React.ReactNode;
}

type AuthTextFieldProps = BaseProps & Omit<React.ComponentProps<"input">, "id">;

/** Labelled text input with validation wiring (data-invalid on Field, aria-invalid on the control). */
export const AuthTextField: React.FC<AuthTextFieldProps> = ({
  id,
  label,
  error,
  hint,
  labelAction,
  ...inputProps
}) => {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <Field data-invalid={error ? true : undefined}>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {labelAction}
      </div>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...inputProps}
      />
      {hint && !error && <FieldDescription id={hintId}>{hint}</FieldDescription>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
};

type AuthPasswordFieldProps = BaseProps &
  Omit<React.ComponentProps<"input">, "id" | "type" | "value"> & {
    value: string;
    showStrength?: boolean;
  };

const STRENGTH_BAR: Record<string, string> = {
  Weak: "bg-destructive",
  Fair: "bg-warning",
  Good: "bg-accent",
  Strong: "bg-success",
};
const STRENGTH_TEXT: Record<string, string> = {
  Weak: "text-destructive",
  Fair: "text-warning",
  Good: "text-accent",
  Strong: "text-success",
};

/** Password input with a show/hide toggle and an optional strength meter that appears once typing starts. */
export const AuthPasswordField: React.FC<AuthPasswordFieldProps> = ({
  id,
  label,
  error,
  hint,
  labelAction,
  value,
  showStrength = false,
  ...inputProps
}) => {
  const [visible, setVisible] = React.useState(false);
  const strengthId = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const strength = evaluatePasswordStrength(value);
  const typing = value.length > 0;

  return (
    <Field data-invalid={error ? true : undefined}>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {labelAction}
      </div>
      <InputGroup>
        <InputGroupInput
          id={id}
          type={visible ? "text" : "password"}
          maxLength={inputProps.maxLength ?? 4096}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : showStrength && typing ? strengthId : hint ? hintId : undefined}
          {...inputProps}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-xs"
            className="size-10 pointer-coarse:size-11 text-muted-foreground hover:text-secondary"
            aria-label={visible ? "Hide password" : "Show password"}
            title={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {hint && !error && <FieldDescription id={hintId}>{hint}</FieldDescription>}
      {error && <FieldError id={errorId}>{error}</FieldError>}

      {showStrength && typing && (
        <div id={strengthId} className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Password strength</span>
              <span className={cn("font-semibold", STRENGTH_TEXT[strength.level])}>{strength.level}</span>
            </div>
            <div className="flex h-1.5 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={cn(
                    "h-full flex-1 rounded-full",
                    step <= strength.score ? STRENGTH_BAR[strength.level] : "bg-border"
                  )}
                />
              ))}
            </div>
          </div>
          <ul className="grid gap-1.5" role="list">
            {strength.requirements.map((req) => (
              <li
                key={req.id}
                className={cn("flex items-center gap-2 text-sm", req.met ? "text-success" : "text-muted-foreground")}
              >
                {req.met ? (
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                    <span className="size-1.5 rounded-full bg-input" />
                  </span>
                )}
                <span>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Field>
  );
};
