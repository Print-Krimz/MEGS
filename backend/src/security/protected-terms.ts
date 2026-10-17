/**
 * Removes clauses that mention protected attributes (age, sex, civil status, religion, height,
 * weight, tattoos, nationality, pregnancy, disability) from free text before it is used for
 * matching. Hiring must not depend on these, so they never reach features or embeddings.
 */
const PROTECTED_WORDS = [
  // Age and birth
  "age", "aged", "years old", "yrs old", "y/o", "born", "birthday", "birthdate", "date of birth", "edad", "taong gulang", "gulang",
  // Sex and gender
  "gender", "sex", "male", "female", "lalaki", "babae",
  // Civil status
  "civil status", "single", "married", "widow", "widowed", "widower", "separated", "divorced", "annulled", "kasal", "binata", "dalaga",
  // Religion
  "religion", "religious", "catholic", "christian", "muslim", "islam", "iglesia", "born again", "adventist", "protestant",
  "mormon", "jehovah", "relihiyon", "katoliko",
  // Body
  "height", "weight", "tall", "kg", "kgs", "lbs", "cm", "tattoo", "tattoos", "tattooed", "tangkad", "timbang",
  // Other protected traits
  "nationality", "citizenship", "citizen", "pregnant", "pregnancy", "buntis", "disability", "disabled", "pwd", "ethnicity", "race",
];

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/ /g, "\\s+");

// Whole words only: "age" must not hit "manage" or "agent", "single" must not hit "single-handedly".
const PROTECTED_PATTERN = new RegExp(`(?<![\\w-])(?:${PROTECTED_WORDS.map(escape).join("|")})(?![\\w-])`, "i");
// Heights such as 5'6" or 5 ft 4.
const HEIGHT_PATTERN = /\b\d\s*(?:'|’|ft|feet)\s*\d{0,2}\b/i;

export const containsProtectedTerm = (text: string) => PROTECTED_PATTERN.test(text) || HEIGHT_PATTERN.test(text);

/** Drops every clause (split on , ; . ! ? and new lines) that mentions a protected attribute. */
export const stripProtectedTerms = (text: string | null | undefined): string => {
  if (!text) return "";
  const parts = text.split(/([,;.!?\n]+)/);
  const kept: string[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    const clause = parts[index];
    const delimiter = parts[index + 1] ?? "";
    if (clause.trim() && !containsProtectedTerm(clause)) kept.push(clause + delimiter);
  }
  return kept.join("").replace(/^[\s,;.!?]+/, "").trim();
};
