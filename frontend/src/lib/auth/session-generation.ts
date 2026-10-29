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

/** JWT `sub` claim (unverified; used only to tell same-account refresh from account change). */
export function tokenSubject(token: string | null | undefined): string | null {
  try {
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}
