import React from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "../../lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-10 text-center bg-white border border-slate-300 my-3",
        className
      )}
    >
      <div className="w-10 h-10 bg-slate-100 border border-slate-300 text-slate-500 flex items-center justify-center mb-2.5">
        {icon || <FolderOpen className="w-5 h-5" />}
      </div>
      <h3 className="text-xs sm:text-sm font-bold font-mono uppercase text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-600 max-w-sm mb-3 leading-normal">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
