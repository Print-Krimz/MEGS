import React from "react";
import { Toaster as SonnerToaster } from "sonner";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Loader2 } from "lucide-react";

export const FeedbackToaster: React.FC = () => {
  return (
    <SonnerToaster
      position="top-right"
      expand={true}
      richColors={false}
      closeButton
      duration={4500}
      icons={{
        success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
        error: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
        info: <Info className="w-4 h-4 text-teal-600 shrink-0" />,
        loading: <Loader2 className="w-4 h-4 text-teal-600 animate-spin shrink-0" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex items-start gap-3 w-full max-w-sm p-3.5 bg-white border border-slate-300 text-slate-900 shadow-modal font-sans text-xs select-none transition-all duration-150 relative",
          title: "font-mono font-bold text-xs uppercase tracking-wide text-slate-900",
          description: "text-xs text-slate-600 leading-normal font-sans mt-0.5",
          actionButton:
            "px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white font-mono text-[11px] font-semibold transition-colors",
          cancelButton:
            "px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-medium transition-colors",
          closeButton:
            "text-slate-400 hover:text-slate-700 p-1 transition-colors border border-transparent hover:border-slate-200",
          success: "border-l-4 border-l-emerald-600 bg-white",
          error: "border-l-4 border-l-rose-600 bg-white",
          warning: "border-l-4 border-l-amber-500 bg-white",
          info: "border-l-4 border-l-teal-600 bg-white",
          loading: "border-l-4 border-l-slate-400 bg-white",
        },
      }}
    />
  );
};
