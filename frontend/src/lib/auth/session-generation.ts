// Identifies "which login" this tab is in. It changes on login, logout, account
// replacement and credential clearing; it does NOT change on token refresh.
// Async work records it at start and drops its result if it has changed.
let generation = 0;
const listeners = new Set<() => void>();

export const getSessionGeneration = (): number => generation;

export function bumpSessionGeneration(): void {
  generation += 1;
  listeners.forEach((listener) => listener());
}

export function onSessionGenerationChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function tokenClaims(token: string | null | undefined): { sub?: unknown; exp?: unknown } | null {
  try {
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as { sub?: unknown; exp?: unknown };
  } catch {
    return null;
  }
}

/** JWT `sub` claim (unverified; used only to tell same-account refresh from account change). */
export function tokenSubject(token: string | null | undefined): string | null {
  const sub = tokenClaims(token)?.sub;
  return typeof sub === "string" && sub ? sub : null;
}

/** JWT `exp` claim in epoch seconds (unverified; only schedules a refresh), or null. */
export function tokenExpiry(token: string | null | undefined): number | null {
  const exp = tokenClaims(token)?.exp;
  return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
}
