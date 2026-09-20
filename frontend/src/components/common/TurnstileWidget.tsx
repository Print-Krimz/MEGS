import { useImperativeHandle, forwardRef, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

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

    useImperativeHandle(ref, () => ({
      reset: () => {
        try {
          turnstileRef.current?.reset();
        } catch {
          // Ignore if widget is not ready
        }
      },
    }));

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
      <div className={`w-full max-w-full flex justify-center items-center min-h-[65px] overflow-hidden ${className}`}>
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={onSuccess}
          onExpire={onExpire}
          onError={onError}
          options={{
            theme,
            size,
            action,
          }}
        />
      </div>
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";
