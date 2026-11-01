import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../lib/api/client";

const OTP_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;

const toMs = (deadline: string | number | null | undefined): number | null => {
  if (deadline === null || deadline === undefined) return null;
  const ms = typeof deadline === "number" ? deadline : Date.parse(deadline);
  return Number.isFinite(ms) ? ms : null;
};

/** mm:ss, the one format every auth countdown uses. */
export const formatCountdown = (seconds: number): string => {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Whole seconds left until `deadline` (ISO string or epoch ms). Always measured against the
 * wall clock at render time, so a throttled background tab catches up as soon as it ticks or
 * regains focus, and a new deadline never shows the old value for a frame.
 * With no deadline `secondsLeft` is 0 and `isDone` is true: callers that need to tell
 * "no deadline" from "expired" check their own deadline value.
 */
export function useCountdown(deadline: string | number | null | undefined) {
  const target = toMs(deadline);
  const remaining = useCallback(
    () => (target === null ? 0 : Math.max(0, Math.ceil((target - Date.now()) / 1000))),
    [target]
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    if (target === null || target <= Date.now()) return;
    const tick = () => {
      setTick((t) => t + 1);
      if (remaining() <= 0) window.clearInterval(timer);
    };
    const timer = window.setInterval(tick, 1_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [target, remaining]);

  const secondsLeft = remaining();
  return { secondsLeft, isDone: secondsLeft <= 0 };
}

/**
 * Timers for a "we sent you a code" step: the resend wait and the code's life.
 * `start` takes the deadlines the server returned; without them (an older backend) it falls back to
 * the known 60 s / 10 min.
 */
export function useOtpTimers(rateLimitDisabled = false) {
  const [deadlines, setDeadlines] = useState<{ expiresAt: string | null; resendAvailableAt: string | null }>({
    expiresAt: null,
    resendAvailableAt: null,
  });
  const resend = useCountdown(deadlines.resendAvailableAt);
  const expiry = useCountdown(deadlines.expiresAt);

  const start = useCallback((sent?: { expiresAt?: string; resendAvailableAt?: string }) => {
    const now = Date.now();
    setDeadlines({
      expiresAt: sent?.expiresAt ?? new Date(now + OTP_TTL_MS).toISOString(),
      resendAvailableAt: sent?.resendAvailableAt ?? new Date(now + RESEND_COOLDOWN_MS).toISOString(),
    });
  }, []);

  return {
    start,
    cooldown: rateLimitDisabled ? 0 : resend.secondsLeft,
    expiresIn: expiry.secondsLeft,
    expired: deadlines.expiresAt !== null && expiry.isDone,
  };
}

/** Counts down a 429 lockout. `lock(error)` returns true when the error carried a wait time. */
export function useLockout() {
  const [until, setUntil] = useState<number | null>(null);
  const { secondsLeft } = useCountdown(until);

  const lock = useCallback((error: unknown): boolean => {
    if (!(error instanceof ApiError) || error.status !== 429 || !error.retryAfter) return false;
    setUntil(Date.now() + error.retryAfter * 1000);
    return true;
  }, []);

  return { lock, secondsLeft, isLocked: until !== null && secondsLeft > 0 };
}
