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
    // Sits below the 64 px header and inside the screen on narrow phones.
    <div
      className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 w-[calc(100%-2rem)] max-w-sm pointer-events-none"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => {
        const isClickable = Boolean(onToastClick);
        const content = (
          <>
            <span className="w-7 h-7 bg-navy border border-navy-lift text-navy-bar flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <span className="block space-y-0.5 min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-100 truncate">
                  {toast.title}
                </span>
                {toast.link && <ArrowUpRight className="w-3 h-3 text-navy-bar shrink-0" aria-hidden="true" />}
              </span>
              <span className="block text-xs text-slate-300 leading-normal font-sans line-clamp-3">
                {toast.message}
              </span>
            </span>
          </>
        );

        return (
          <div
            key={toast.id}
            // Hovering or focusing a toast holds the auto-dismiss timer.
            onMouseEnter={() => toast.pause?.()}
            onMouseLeave={() => toast.resume?.()}
            onFocus={() => toast.pause?.()}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) toast.resume?.();
            }}
            className="pointer-events-auto bg-slate-950 text-white border border-slate-700 shadow-modal flex items-stretch justify-between gap-1"
          >
            {isClickable ? (
              <button
                type="button"
                onClick={() => onToastClick?.(toast)}
                title={toast.link ? "Click to view notification details" : undefined}
                className="flex items-start gap-2.5 min-w-0 flex-1 p-3.5 pr-0 text-left cursor-pointer hover:bg-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-on-dark"
              >
                {content}
              </button>
            ) : (
              <div className="flex items-start gap-2.5 min-w-0 flex-1 p-3.5 pr-0">{content}</div>
            )}

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-white min-h-11 min-w-11 self-start flex items-center justify-center p-1 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-on-dark"
              title="Dismiss notification"
              aria-label={`Dismiss notification: ${toast.title}`}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
