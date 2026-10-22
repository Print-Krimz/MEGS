import { getManilaToday } from "./field-limits";

// Walk-in applicants must be 18 to 65 years old (the backend enforces the same range).
export const MIN_AGE = 18;
export const MAX_AGE = 65;

/** YYYY-MM-DD for the Manila date `years` years before today. */
export const yearsAgo = (years: number): string => {
  const [y, m, d] = getManilaToday().split("-");
  return `${Number(y) - years}-${m}-${d}`;
};
