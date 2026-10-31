// Last time a signed-in user touched the page. Kept in localStorage so every tab shares it
// and a browser restart cannot reset the idle clock.
const LAST_ACTIVITY_KEY = "megs.lastActivity";

export function readLastActivity(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeLastActivity(now: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch {
    // Storage blocked: the idle clock then runs from this tab's own state only.
  }
}

export function clearLastActivity(): void {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // Nothing to clear.
  }
}
