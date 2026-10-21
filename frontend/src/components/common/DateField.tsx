import React from "react";
import { Input, type InputProps } from "../ui/Input";
import { formatDate } from "../../lib/utils";

export interface DateFieldProps extends Omit<InputProps, "type" | "helperText"> {
  /** Hint shown after the formatted date. */
  help?: string;
  helperText?: string;
}

/**
 * Native date input that also writes the chosen date out ("Oct 28, 2026"), so people can
 * confirm it without decoding the browser locale format.
 */
export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  ({ help, helperText, value, ...props }, ref) => {
    const raw = typeof value === "string" ? value : "";
    const formatted = raw ? formatDate(raw) : "";
    const shown = formatted && formatted !== "—" ? formatted : "";
    const hint = help ?? helperText;
    const text = shown ? (hint ? `${shown}. ${hint}` : shown) : hint;
    return <Input ref={ref} type="date" value={value} helperText={text} {...props} />;
  },
);
DateField.displayName = "DateField";
