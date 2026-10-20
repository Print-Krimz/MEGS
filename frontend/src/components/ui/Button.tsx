import React from "react";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /**
   * Render the single child element (e.g. a TanStack `<Link>`) with the button styling instead of a <button>.
   * Icons and `loading` are ignored in this mode; put them inside the child.
   */
  asChild?: boolean;
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
      asChild = false,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center min-h-11 md:min-h-9 rounded-md font-medium font-sans border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 select-none";

    const variantStyles = {
      primary:
        "bg-navy hover:bg-navy-hover text-white border-navy active:bg-navy-hover",
      secondary:
        "bg-white hover:bg-navy-soft text-navy hover:text-navy-hover border-navy-line active:bg-navy-line",
      outline:
        "bg-white hover:bg-navy-soft text-navy hover:text-navy-hover border-navy-line active:bg-navy-line",
      ghost:
        "border-transparent text-navy hover:text-navy-hover hover:bg-navy-soft active:bg-navy-line",
      danger:
        "bg-danger hover:bg-red-700 text-white border-danger active:bg-red-800",
    };

    const sizeStyles = {
      sm: "text-sm px-3 py-1.5 gap-1.5",
      md: "text-sm px-4 py-2 gap-2",
      lg: "text-base px-5 py-2.5 gap-2.5 font-semibold",
    };

    const classes = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

    if (asChild) {
      return (
        <Slot.Root ref={ref as React.Ref<HTMLElement>} className={classes} {...(props as React.HTMLAttributes<HTMLElement>)}>
          {children}
        </Slot.Root>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={classes}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
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
