import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";
import { ApiError } from "../../lib/api/client";
import { cn } from "../../lib/utils";

export interface ErrorStateProps {
  error?: Error | ApiError | null;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  message,
  onRetry,
  className,
}) => {
  const displayMessage =
    message ||
    (error instanceof ApiError
      ? error.message
      : error instanceof Error
      ? error.message
      : "An unexpected error occurred while loading this view.");

  const statusCode = error instanceof ApiError ? error.status : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-rose-50/40 border border-rose-200 rounded-xl my-4",
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3 border border-rose-200">
        <AlertTriangle className="w-6 h-6" />
      </div>

      {statusCode && (
        <span className="text-[10px] font-mono font-bold uppercase text-rose-700 bg-rose-100 px-2 py-0.5 rounded-sm mb-1">
          Error {statusCode}
        </span>
      )}

      <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
        Failed to Load Data
      </h3>
      <p className="text-xs sm:text-sm text-slate-600 max-w-md mb-5 leading-relaxed">
        {displayMessage}
      </p>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          className="border-slate-300 hover:bg-white"
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
