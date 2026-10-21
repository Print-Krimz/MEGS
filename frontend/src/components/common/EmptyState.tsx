import React from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "../../lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Drop the border and outer margin when already inside a framed container. */
  bare?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  bare = false,
  className,
}) => {
  const renderedIcon = React.isValidElement(icon)
    ? icon
    : typeof icon === "function" || (typeof icon === "object" && icon !== null && !("props" in icon))
    ? React.createElement(icon as React.ComponentType<{ className?: string }>, { className: "w-5 h-5" })
    : (icon as React.ReactNode) || <FolderOpen className="w-5 h-5" />;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-10 text-center",
        bare ? "bg-transparent" : "bg-white border border-slate-300 rounded-md my-3",
        className
      )}
    >
      <div className="w-10 h-10 bg-slate-100 border border-slate-300 rounded-md text-slate-500 flex items-center justify-center mb-2.5">
        {renderedIcon}
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-600 max-w-sm mb-3 leading-normal">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
