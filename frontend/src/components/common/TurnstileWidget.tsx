import { useImperativeHandle, forwardRef, useRef, useState, useEffect, useCallback } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { RefreshCw, AlertCircle } from "lucide-react";

export interface TurnstileWidgetRef {
  reset: () => void;
}

export interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: (error?: string | Error) => void;
  className?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  action?: string;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  (
    {
      onSuccess,
      onExpire,
      onError,
      className = "",
      theme = "light",
      size = "flexible",
      action,
    },
    ref
  ) => {
    const turnstileRef = useRef<TurnstileInstance | null>(null);
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    const isCaptchaDisabled = import.meta.env.VITE_DISABLE_CAPTCHA === "true";

    const [reloadKey, setReloadKey] = useState(0);
    const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error" | "expired">("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isTimedOut, setIsTimedOut] = useState(false);

    // Auto-bypass if explicitly disabled via environment variable
    useEffect(() => {
      if (isCaptchaDisabled) {
        onSuccess("bypassed");
      }
    }, [isCaptchaDisabled, onSuccess]);

    const handleReset = useCallback(() => {
      setErrorMessage(null);
      setIsTimedOut(false);
      if (window.turnstile && turnstileRef.current) {
        try {
          turnstileRef.current.reset();
          setStatus("verifying");
          return;
        } catch {
          // Recover by remounting only if the existing widget cannot reset.
        }
      }
      setStatus("idle");
      // The library keeps a module-level loading promise. If api.js failed to load,
      // its old script element prevents a remount from requesting the script again.
      if (!window.turnstile) {
        document.getElementById("cf-turnstile-script")?.remove();
      }
      setReloadKey((k) => k + 1);
    }, []);

    useImperativeHandle(ref, () => ({
      reset: handleReset,
    }));

    // Timeout detection: after 7 seconds of pending, suggest reload
    useEffect(() => {
      if (isCaptchaDisabled || !siteKey || status === "success") return;

      const timer = setTimeout(() => {
        if (status === "verifying" || status === "idle") {
          setIsTimedOut(true);
        }
      }, 7000);

      return () => clearTimeout(timer);
    }, [reloadKey, status, isCaptchaDisabled, siteKey]);

    if (isCaptchaDisabled) {
      return null;
    }

    if (!siteKey) {
      return (
        <div
          role="status"
          className={`w-full p-2.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 text-center ${className}`}
        >
          Turnstile site key missing in environment.
        </div>
      );
    }

    return (
      <div className={`w-full max-w-full flex flex-col justify-center items-center py-1 min-h-[65px] ${className}`}>
        <div className="w-full flex justify-center items-center overflow-hidden">
          <Turnstile
            key={reloadKey}
            ref={turnstileRef}
            siteKey={siteKey}
            onWidgetLoad={() => setStatus((current) => current === "success" ? current : "verifying")}
            onSuccess={(token) => {
              setStatus("success");
              setIsTimedOut(false);
              setErrorMessage(null);
              onSuccess(token);
            }}
            onExpire={() => {
              setStatus("expired");
              setErrorMessage("Security verification expired. Please retry.");
              onExpire?.();
            }}
            onError={(err) => {
              setStatus("error");
              setErrorMessage("Security verification could not complete. Please retry.");
              onError?.(err);
            }}
            onTimeout={() => {
              setStatus("error");
              setErrorMessage("Security verification timed out. Please retry.");
              onError?.();
            }}
            options={{ theme, size, action }}
          />
        </div>

        {errorMessage && (
          <div className="w-full p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-start gap-1.5 text-left">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Security Check Notice</p>
                <p className="text-[11px] text-rose-700 leading-snug">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-white border border-rose-300 rounded shadow-xs hover:bg-rose-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-rose-500 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {isTimedOut && status !== "success" && !errorMessage && (
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 animate-fade-in">
            <span>Verification is taking longer than usual. Check your connection or browser extensions.</span>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 font-semibold text-[#0B315D] hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reload verification</span>
            </button>
          </div>
        )}
        {!isTimedOut && status === "idle" && !errorMessage && (
          <span role="status" className="mt-1 text-[11px] text-slate-500">Loading security verification…</span>
        )}
        {!isTimedOut && status === "verifying" && !errorMessage && (
          <span role="status" className="mt-1 text-[11px] text-slate-500">Complete the security verification above.</span>
        )}
      </div>
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";
