import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";
import { ApiError } from "../../lib/api/client";
import { cn } from "../../lib/utils";
import { formatErrorMessage } from "../../lib/feedback";

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
  const displayMessage = message || (error ? formatErrorMessage(error) : "We couldn't load this information.");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-rose-50/40 border border-rose-200 rounded-lg my-4",
        className,
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3 border border-rose-200">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
        Unable to load this information
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
