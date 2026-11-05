/** What a hidden rate says instead: nothing recorded yet, or too few cases (under 5) to be a fair figure. */
export const sampleNote = (_n?: number): string =>
  _n === 0 ? "No data yet" : "No data yet";

/** Prints a sampled rate, or says how few records stood behind a hidden one. */
export function formatSampled(value: number | null, n: number, unit: "%" | "days"): string {
  if (value === null) return sampleNote(n);
  return unit === "%" ? `${value}%` : `${value} ${value === 1 ? "day" : "days"}`;
}

/** "today", "1 day ago", "N days ago", counted in whole days. Empty when there is no date. */
export function daysAgoText(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
}
