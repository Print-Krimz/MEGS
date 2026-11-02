/** Prints a sampled rate, or says how few records stood behind a hidden one. */
export function formatSampled(value: number | null, n: number, unit: "%" | "days"): string {
  if (value === null) return `Not enough data (n=${n})`;
  return unit === "%" ? `${value}%` : `${value} ${value === 1 ? "day" : "days"}`;
}
