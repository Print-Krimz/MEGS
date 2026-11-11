const COMPANY_SUFFIXES = new Set(["inc", "incorporated", "corp", "corporation", "co", "company", "ltd", "limited", "llc"]);

/** Lowercase, no punctuation, no Inc/Corp/Co style endings, so "Crestline Assembly Mfg. Inc." and "crestline assembly mfg" compare equal. Same rules as frontend/src/lib/mrf-schedule.ts. */
export const normalizeCompanyName = (name: string): string => {
  const words = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ");
};
