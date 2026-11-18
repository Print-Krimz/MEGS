import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "purple";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "neutral",
  size = "md",
  children,
  ...props
}) => {
  const variantStyles = {
    neutral: "bg-slate-100 text-slate-800 border-slate-300",
    primary: "bg-navy-soft text-navy border-navy-line",
    success: "bg-emerald-50 text-emerald-900 border-emerald-300",
    warning: "bg-amber-50 text-amber-900 border-amber-300",
    danger: "bg-rose-50 text-rose-900 border-rose-300",
    info: "bg-sky-50 text-sky-900 border-sky-300",
    purple: "bg-indigo-50 text-indigo-900 border-indigo-300",
  };

  const sizeStyles = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-0.5 text-xs",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-medium text-xs border select-none shrink-0",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
