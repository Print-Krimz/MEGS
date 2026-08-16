import React from "react";
import { Bell, X } from "lucide-react";
import type { RealtimeToast } from "../../hooks/useRealtimeNotifications";

export interface RealtimeToastContainerProps {
  toasts: RealtimeToast[];
  onDismiss: (id: number) => void;
}

export const RealtimeToastContainer: React.FC<RealtimeToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-slate-950 text-white p-3.5 border border-slate-700 shadow-modal flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 bg-teal-950 border border-teal-500 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-bold font-mono uppercase text-slate-100">{toast.title}</div>
              <p className="text-xs text-slate-300 leading-normal font-sans">{toast.message}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="text-slate-400 hover:text-white p-1 transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
