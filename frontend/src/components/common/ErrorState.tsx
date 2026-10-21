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
  /** What failed to load, e.g. "applications" gives the title "Couldn't load applications". */
  subject?: string;
  /** Inline banner for a failed section: one row, no illustration. */
  compact?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  message,
  onRetry,
  subject,
  compact = false,
  className,
}) => {
  const displayMessage =
    message ||
    (error ? formatErrorMessage(error) : subject ? "Check your connection and try again." : "We couldn't load this information.");
  const title = subject ? `Couldn't load ${subject}` : "Unable to load this information";

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-rose-200 bg-rose-50/50 px-3 py-2.5",
          className,
        )}
        role="alert"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm text-slate-800">
          <span className="font-medium">{title}.</span> {displayMessage}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RotateCcw className="h-3.5 w-3.5" />} className="border-slate-300 bg-white">
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-rose-50/40 border border-rose-200 rounded-md my-4",
        className,
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3 border border-rose-200">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">{title}</h3>
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
          Try again
        </Button>
      )}
    </div>
  );
};
