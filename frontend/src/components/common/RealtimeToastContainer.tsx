import React from "react";
import { Bell, X, ArrowUpRight } from "lucide-react";
import type { RealtimeToast } from "../../hooks/useRealtimeNotifications";

export interface RealtimeToastContainerProps {
  toasts: RealtimeToast[];
  onDismiss: (id: number) => void;
  onToastClick?: (toast: RealtimeToast) => void;
}

export const RealtimeToastContainer: React.FC<RealtimeToastContainerProps> = ({
  toasts,
  onDismiss,
  onToastClick,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => {
        const isClickable = Boolean(onToastClick);

        return (
          <div
            key={toast.id}
            role={isClickable ? "button" : "status"}
            tabIndex={isClickable ? 0 : undefined}
            aria-label={isClickable ? `Notification: ${toast.title}` : undefined}
            onClick={() => onToastClick?.(toast)}
            onKeyDown={(e) => {
              if (isClickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onToastClick?.(toast);
              }
            }}
            title={toast.link ? "Click to view notification details" : undefined}
            className={`pointer-events-auto bg-slate-950 text-white p-3.5 border border-slate-700 shadow-modal flex items-start justify-between gap-3 ${
              isClickable
                ? "hover:border-teal-500 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                : ""
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 bg-teal-950 border border-teal-500 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold font-mono uppercase text-slate-100 truncate">
                    {toast.title}
                  </span>
                  {toast.link && <ArrowUpRight className="w-3 h-3 text-teal-400 shrink-0" />}
                </div>
                <p className="text-xs text-slate-300 leading-normal font-sans line-clamp-3">
                  {toast.message}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(toast.id);
              }}
              className="text-slate-400 hover:text-white min-h-[32px] min-w-[32px] flex items-center justify-center p-1 transition-colors rounded shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              title="Dismiss notification"
              aria-label={`Dismiss notification: ${toast.title}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
