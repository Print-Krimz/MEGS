declare global {
  interface Window {
    onloadTurnstileCallback?: () => void;
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          action?: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          retry?: "auto" | "never";
          "retry-interval"?: number;
          "refresh-expired"?: "auto" | "manual" | "never";
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

    let resolved = false;

    const onReady = () => {
      if (resolved) return;
      if (isReady()) {
        resolved = true;
        clearInterval(checkInterval);
        scriptLoadingPromise = null;
        resolve();
      }
    };

    // Wire global callback expected by ?onload=onloadTurnstileCallback
    const prevCallback = window.onloadTurnstileCallback;
    window.onloadTurnstileCallback = () => {
      try {
        prevCallback?.();
      } catch {
        // Ignore previous callback error
      }
      onReady();
    };

    // Fast polling fallback in case script was already in DOM or loaded before callback attached
    const checkInterval = setInterval(() => {
      if (isReady()) {
        clearInterval(checkInterval);
        onReady();
      }
    }, 50);

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.querySelector(
        'script[src*="challenges.cloudflare.com/turnstile"]'
      ) as HTMLScriptElement | null;
    }

    const onScriptError = () => {
      clearInterval(checkInterval);
      scriptLoadingPromise = null;
      reject(new Error("Failed to load Cloudflare Turnstile script. Please check your network or ad-blocker."));
    };

    if (script) {
      script.addEventListener("error", onScriptError, { once: true });
    } else {
      const newScript = document.createElement("script");
      newScript.id = SCRIPT_ID;
      newScript.src = `${SCRIPT_URL}&onload=onloadTurnstileCallback`;
      newScript.async = true;
      newScript.defer = true;
      newScript.addEventListener("error", onScriptError, { once: true });
      document.head.appendChild(newScript);
    }

    // Safety timeout after 12 seconds
    setTimeout(() => {
      if (!resolved && !isReady()) {
        clearInterval(checkInterval);
        scriptLoadingPromise = null;
        reject(new Error("Turnstile script load timed out. Please check browser shields or ad-blockers."));
      }
    }, 12000);
  });

  return scriptLoadingPromise;
}

/**
 * Start fetching the Turnstile script early (hover/focus/touch on a sign-in link) so the
 * widget is ready sooner on the auth page. Does nothing when CAPTCHA is off or has no site key.
 */
export function warmTurnstile(): void {
  if (import.meta.env.VITE_DISABLE_CAPTCHA === "true" || !import.meta.env.VITE_TURNSTILE_SITE_KEY) {
    return;
  }
  // A failed warm-up is harmless: the widget reports the load error itself when it mounts.
  loadTurnstileScript().catch(() => {});
}
