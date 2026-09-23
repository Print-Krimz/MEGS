import {
  useImperativeHandle,
  forwardRef,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { RefreshCw, AlertCircle, Loader2 } from "lucide-react";

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

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          action?: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (error?: any) => void;
          "timeout-callback"?: () => void;
          [key: string]: any;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
      ready: (callback: () => void) => void;
    };
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

let scriptLoadingPromise: Promise<void> | null = null;

export function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const isReady = () =>
    !!window.turnstile && typeof window.turnstile.render === "function";

  if (isReady()) {
    return Promise.resolve();
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    if (isReady()) {
      resolve();
      return;
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.querySelector(
        'script[src*="challenges.cloudflare.com/turnstile"]'
      ) as HTMLScriptElement | null;
    }

    let resolved = false;

    const checkInterval = setInterval(() => {
      if (isReady()) {
        clearInterval(checkInterval);
        resolved = true;
        resolve();
      }
    }, 50);

    const onScriptLoad = () => {
      if (isReady()) {
        clearInterval(checkInterval);
        resolved = true;
        resolve();
      } else {
        let count = 0;
        const subInterval = setInterval(() => {
          count++;
          if (isReady()) {
            clearInterval(subInterval);
            clearInterval(checkInterval);
            resolved = true;
            resolve();
          } else if (count > 60) {
            clearInterval(subInterval);
            clearInterval(checkInterval);
            scriptLoadingPromise = null;
            reject(new Error("Turnstile script loaded but window.turnstile.render is not available."));
          }
        }, 50);
      }
    };

    const onScriptError = () => {
      clearInterval(checkInterval);
      scriptLoadingPromise = null;
      reject(new Error("Failed to load Cloudflare Turnstile script. Please check your network or ad-blocker."));
    };

    if (script) {
      if (script.hasAttribute("data-loaded") || (script as any).readyState === "complete") {
        onScriptLoad();
      } else {
        script.addEventListener("load", onScriptLoad, { once: true });
        script.addEventListener("error", onScriptError, { once: true });
      }
    } else {
      const newScript = document.createElement("script");
      newScript.id = SCRIPT_ID;
      newScript.src = SCRIPT_URL;
      newScript.async = true;
      newScript.defer = true;
      newScript.addEventListener("load", onScriptLoad, { once: true });
      newScript.addEventListener("error", onScriptError, { once: true });
      document.head.appendChild(newScript);
    }

    // Fallback timeout after 12 seconds
    setTimeout(() => {
      if (!resolved && !window.turnstile) {
        clearInterval(checkInterval);
        scriptLoadingPromise = null;
        reject(new Error("Turnstile script load timed out."));
      }
    }, 12000);
  });

  return scriptLoadingPromise;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  (
    {
      onSuccess,
      onExpire,
      onError,
      className = "",
      theme = "light",
      size = "normal",
      action,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const isMountedRef = useRef(true);

    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    const isCaptchaDisabled = import.meta.env.VITE_DISABLE_CAPTCHA === "true";

    const [status, setStatus] = useState<"loading" | "ready" | "verified" | "expired" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const onSuccessRef = useRef(onSuccess);
    onSuccessRef.current = onSuccess;

    const onExpireRef = useRef(onExpire);
    onExpireRef.current = onExpire;

    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    // Handle bypass if explicitly disabled
    useEffect(() => {
      if (isCaptchaDisabled) {
        onSuccessRef.current("bypassed");
      }
    }, [isCaptchaDisabled]);

    // Handle reset imperatively
    const handleReset = useCallback(() => {
      if (import.meta.env.DEV) {
        console.debug("[Turnstile] Reset requested.");
      }
      setErrorMessage(null);

      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.reset(widgetIdRef.current);
          setStatus("ready");
          if (import.meta.env.DEV) {
            console.debug("[Turnstile] Widget reset succeeded for ID:", widgetIdRef.current);
          }
          return;
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn("[Turnstile] Reset failed on existing widget, re-rendering:", err);
          }
        }
      }

      // If reset failed or widget was not yet initialized, cleanly remove and recreate
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore remove error
        }
        widgetIdRef.current = null;
      }

      setRetryCount((c) => c + 1);
    }, []);

    useImperativeHandle(ref, () => ({
      reset: handleReset,
    }));

    // Initialize and render Turnstile widget
    useEffect(() => {
      isMountedRef.current = true;
      let cancelled = false;

      if (isCaptchaDisabled) {
        return;
      }

      if (!siteKey) {
        setStatus("error");
        setErrorMessage("Turnstile site key missing in environment.");
        return;
      }

      const initializeWidget = async () => {
        setStatus("loading");
        setErrorMessage(null);

        try {
          if (import.meta.env.DEV) {
            console.debug("[Turnstile] Ensuring script is loaded...");
          }
          await loadTurnstileScript();

          if (cancelled || !isMountedRef.current) return;

          if (!window.turnstile) {
            throw new Error("window.turnstile is not available");
          }

          const renderWidget = () => {
            if (cancelled || !isMountedRef.current || !containerRef.current) return;

            // Prevent duplicate widget rendering on same container
            if (widgetIdRef.current) {
              if (import.meta.env.DEV) {
                console.debug("[Turnstile] Widget already rendered with ID:", widgetIdRef.current);
              }
              return;
            }

            // Ensure container is empty before rendering
            containerRef.current.innerHTML = "";

            try {
              if (import.meta.env.DEV) {
                console.debug("[Turnstile] Calling window.turnstile.render()...");
              }

              setStatus("ready");

              const id = window.turnstile!.render(containerRef.current, {
                sitekey: siteKey,
                action,
                theme,
                size,
                retry: "auto",
                "retry-interval": 8000,
                "refresh-expired": "auto",
                callback: (token: string) => {
                  if (!isMountedRef.current) return;
                  if (import.meta.env.DEV) {
                    console.debug("[Turnstile] Challenge completed. Token verified.");
                  }
                  setStatus("verified");
                  setErrorMessage(null);
                  onSuccessRef.current(token);
                },
                "expired-callback": () => {
                  if (!isMountedRef.current) return;
                  if (import.meta.env.DEV) {
                    console.debug("[Turnstile] Token expired.");
                  }
                  setStatus("expired");
                  setErrorMessage("Security verification expired. Please retry.");
                  onExpireRef.current?.();
                },
                "error-callback": (err: any) => {
                  if (!isMountedRef.current) return;
                  if (import.meta.env.DEV) {
                    console.warn("[Turnstile] Challenge error callback:", err);
                  }
                  setStatus("error");
                  const code = typeof err === "string" || typeof err === "number" ? ` (Code: ${err})` : "";
                  setErrorMessage(
                    `Security verification failed${code}. Please retry or check browser shields/extensions.`
                  );
                  onErrorRef.current?.(err);
                },
                "timeout-callback": () => {
                  if (!isMountedRef.current) return;
                  if (import.meta.env.DEV) {
                    console.warn("[Turnstile] Challenge timeout callback.");
                  }
                  setStatus("error");
                  setErrorMessage("Security verification timed out. Please retry.");
                  onErrorRef.current?.();
                },
              });

              widgetIdRef.current = id;
              if (import.meta.env.DEV) {
                console.debug("[Turnstile] Widget successfully mounted with ID:", id);
              }
            } catch (renderErr) {
              if (import.meta.env.DEV) {
                console.error("[Turnstile] Render error:", renderErr);
              }
              setStatus("error");
              setErrorMessage("Could not initialize security verification widget.");
              onErrorRef.current?.(renderErr as Error);
            }
          };

          // Render widget directly once script and window.turnstile.render are available.
          // Cloudflare Turnstile prohibits turnstile.ready() when api.js has async/defer attributes.
          renderWidget();
        } catch (err: any) {
          if (cancelled || !isMountedRef.current) return;
          if (import.meta.env.DEV) {
            console.error("[Turnstile] Script initialization error:", err);
          }
          setStatus("error");
          setErrorMessage(
            err?.message || "Security verification failed to load. Please check your connection or ad-blocker."
          );
          onErrorRef.current?.(err);
        }
      };

      initializeWidget();

      return () => {
        cancelled = true;
        isMountedRef.current = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            if (import.meta.env.DEV) {
              console.debug("[Turnstile] Cleaning up widget on unmount:", widgetIdRef.current);
            }
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore unmount remove errors
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, action, theme, size, isCaptchaDisabled, retryCount]);

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
      <div className={`w-full max-w-full flex flex-col items-center justify-center min-h-[65px] ${className}`}>
        {/* Reserved space container: containerRef is ALWAYS in normal flow and visible */}
        <div className="w-full min-h-[65px] flex items-center justify-center relative">
          {/* Lightweight loading placeholder overlay: only visible while waiting for script before widget renders */}
          {status === "loading" && !widgetIdRef.current && (
            <div
              role="status"
              className="absolute inset-0 max-w-[300px] mx-auto h-[65px] rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-center gap-2 text-xs text-slate-500 animate-pulse select-none pointer-events-none z-10"
            >
              <Loader2 className="w-4 h-4 animate-spin text-[#0B315D]" />
              <span>Loading security verification...</span>
            </div>
          )}

          {/* Turnstile explicit mount target - always visible and in normal document flow */}
          <div
            ref={containerRef}
            className="w-full flex justify-center items-center min-h-[65px]"
          />
        </div>

        {/* Error notification and retry button */}
        {errorMessage && (
          <div className="w-full mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2 animate-fade-in">
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
      </div>
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";
