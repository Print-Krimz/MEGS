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
      "inline-flex items-center justify-center min-h-11 md:min-h-9 rounded-md font-medium font-sans border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variantStyles = {
      primary:
        "bg-[#0B315D] hover:bg-[#082747] text-white border-[#0B315D] focus:ring-[#0B315D] active:bg-[#082747]",
      secondary:
        "bg-white hover:bg-[#EAF0F7] text-[#0B315D] hover:text-[#082747] border-[#D9E2EC] focus:ring-[#0B315D] active:bg-[#D9E2EC]",
      outline:
        "bg-white hover:bg-[#EAF0F7] text-[#0B315D] hover:text-[#082747] border-[#D9E2EC] focus:ring-[#0B315D] active:bg-[#D9E2EC]",
      ghost:
        "border-transparent text-[#0B315D] hover:text-[#082747] hover:bg-[#EAF0F7] focus:ring-[#0B315D] active:bg-[#D9E2EC]",
      danger:
        "bg-[#DC2626] hover:bg-red-700 text-white border-[#DC2626] focus:ring-[#DC2626] active:bg-red-800",
    };

    const sizeStyles = {
      sm: "text-sm px-3 py-1.5 gap-1.5",
      md: "text-sm px-4 py-2 gap-2",
      lg: "text-base px-5 py-2.5 gap-2.5 font-semibold",
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
