import { useCallback, useEffect, useRef, useState } from "react";
import { readLastActivity, writeLastActivity } from "../lib/auth/idle-activity";

export const IDLE_LIMIT_MS = 60 * 60_000;
export const IDLE_WARNING_MS = 2 * 60_000;

const IDLE_CHECK_MS = 15_000;
const WARNING_CHECK_MS = 1_000;
const ACTIVITY_WRITE_THROTTLE_MS = 30_000;

// Only deliberate input counts. API traffic (polling, the notification stream, token refresh) and
// mouse movement do not, or a forgotten tab would keep itself signed in forever.
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Tracks how long the signed-in user has gone without touching the page. The clock is shared
 * across tabs through localStorage. `warning` turns on for the last IDLE_WARNING_MS, `stay`
 * restarts the clock, and `expired` means the limit has passed and the caller should sign out.
 */
export function useIdleSignOut() {
  const [expired, setExpired] = useState(() => {
    const last = readLastActivity();
    return last !== null && Date.now() - last >= IDLE_LIMIT_MS;
  });
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const warningRef = useRef(false);
  const lastWriteRef = useRef(0);

  const evaluate = useCallback(() => {
    const last = readLastActivity();
    if (last === null) {
      // No record yet (a session that started before this feature, or storage was cleared): start the clock now.
      writeLastActivity();
      lastWriteRef.current = Date.now();
      warningRef.current = false;
      setSecondsLeft(null);
      return;
    }
    const remaining = IDLE_LIMIT_MS - (Date.now() - last);
    if (remaining <= 0) {
      warningRef.current = false;
      setSecondsLeft(null);
      setExpired(true);
    } else if (remaining <= IDLE_WARNING_MS) {
      warningRef.current = true;
      setSecondsLeft(Math.ceil(remaining / 1000));
    } else {
      warningRef.current = false;
      setSecondsLeft(null);
    }
  }, []);

  const stay = useCallback(() => {
    writeLastActivity();
    lastWriteRef.current = Date.now();
    warningRef.current = false;
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    const onActivity = () => {
      // While the warning is up, only the "Stay signed in" action extends the session.
      if (warningRef.current) return;
      const now = Date.now();
      if (now - lastWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) return;
      writeLastActivity(now);
      lastWriteRef.current = now;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") evaluate();
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { capture: true, passive: true });
    window.addEventListener("focus", evaluate);
    window.addEventListener("storage", evaluate);
    document.addEventListener("visibilitychange", onVisible);
    evaluate();
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity, { capture: true });
      window.removeEventListener("focus", evaluate);
      window.removeEventListener("storage", evaluate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [evaluate]);

  const warning = secondsLeft !== null;
  useEffect(() => {
    const timer = window.setInterval(evaluate, warning ? WARNING_CHECK_MS : IDLE_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [evaluate, warning]);

  return { warning, secondsLeft, expired, stay };
}
