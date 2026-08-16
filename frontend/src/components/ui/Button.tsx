import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      type = "button",
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium font-sans uppercase tracking-wider text-xs border transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variantStyles = {
      primary:
        "bg-teal-700 hover:bg-teal-800 text-white border-teal-800 focus:ring-teal-600 active:bg-teal-900",
      secondary:
        "bg-slate-800 hover:bg-slate-900 text-white border-slate-900 focus:ring-slate-700 active:bg-slate-950",
      outline:
        "border-slate-300 bg-white hover:bg-slate-100 text-slate-800 focus:ring-teal-600 active:bg-slate-200",
      ghost:
        "border-transparent text-slate-700 hover:text-slate-950 hover:bg-slate-200/70 focus:ring-slate-400 active:bg-slate-300",
      danger:
        "bg-rose-700 hover:bg-rose-800 text-white border-rose-800 focus:ring-rose-600 active:bg-rose-900",
    };

    const sizeStyles = {
      sm: "text-[11px] px-2.5 py-1 gap-1.5 font-semibold",
      md: "text-xs px-3.5 py-1.5 gap-2 font-semibold",
      lg: "text-sm px-4.5 py-2 gap-2.5 font-bold",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
