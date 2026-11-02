/** What a hidden rate says instead: nothing recorded yet, or too few cases (under 5) to be a fair figure. */
export const sampleNote = (n: number): string =>
  n === 0 ? "No data yet" : `Too few to show (${n} ${n === 1 ? "case" : "cases"})`;

/** Prints a sampled rate, or says how few records stood behind a hidden one. */
export function formatSampled(value: number | null, n: number, unit: "%" | "days"): string {
  if (value === null) return sampleNote(n);
  return unit === "%" ? `${value}%` : `${value} ${value === 1 ? "day" : "days"}`;
}
