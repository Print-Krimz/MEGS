/**
 * Applicant job filters: worksite location and salary range.
 *
 * Job postings keep the worksite as free text ("Caloocan, Metro Manila (NCR)",
 * "1 Jacker, La Huerta, Parañaque, Metro Manila (NCR), 1700"), so a plain
 * substring match gets places wrong: "Manila" also hits "Metro Manila", and
 * "San Juan" also hits San Juan, Batangas. Known places are matched by whole
 * words instead; anything else falls back to a case-insensitive substring match.
 */

export const NCR_FILTER_VALUE = "Metro Manila (NCR)";

/** NCR cities and the municipality of Pateros, by the name applicants know them by. */
export const NCR_CITY_NAMES = [
  "Caloocan",
  "Las Piñas",
  "Makati",
  "Malabon",
  "Mandaluyong",
  "Manila",
  "Marikina",
  "Muntinlupa",
  "Navotas",
  "Parañaque",
  "Pasay",
  "Pasig",
  "Pateros",
  "Quezon City",
  "San Juan",
  "Taguig",
  "Valenzuela",
] as const;

/** Names shared with towns outside NCR: only counted when the text also says NCR or "<name> City". */
const AMBIGUOUS_NCR_NAMES = new Set(["san juan"]);

const PROVINCE_ALIASES: Record<string, string[]> = {
  laguna: ["laguna"],
  cavite: ["cavite"],
  batangas: ["batangas"],
  rizal: ["rizal"],
  bulacan: ["bulacan"],
  pampanga: ["pampanga"],
  cebu: ["cebu"],
  davao: ["davao"],
  iloilo: ["iloilo"],
  pangasinan: ["pangasinan"],
  "quezon province": ["quezon province"],
  bataan: ["bataan"],
  benguet: ["benguet"],
  "misamis oriental": ["misamis oriental"],
  "negros occidental": ["negros occidental"],
};

const NCR_TEXT_MARKERS = ["metro manila", "national capital region", "ncr"];

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("en")
    .replace(/\(ncr\)/g, " ncr ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const hasPhrase = (text: string, phrase: string): boolean =>
  new RegExp(`(^| )${phrase}( |$)`).test(text);

const stripMetroManila = (text: string): string => text.replace(/\bmetro manila\b/g, " ");

const mentionsNcr = (text: string): boolean => NCR_TEXT_MARKERS.some((marker) => hasPhrase(text, marker));

const ncrCityKey = (filter: string): string | undefined => {
  const key = normalize(filter).replace(/^city of /, "").replace(/ city$/, "");
  const match = NCR_CITY_NAMES.find((name) => normalize(name).replace(/ city$/, "") === key);
  return match ? normalize(match).replace(/ city$/, "") : undefined;
};

const cityPhrases = (key: string): string[] =>
  key === "quezon" ? ["quezon city"] : [key, `${key} city`, `city of ${key}`];

/**
 * Returns a matcher for the filter value, or null when the filter is blank.
 * `Metro Manila (NCR)` (or "NCR") matches every NCR worksite.
 */
export const buildLocationMatcher = (filter?: string | null): ((location?: string | null) => boolean) | null => {
  const raw = filter?.trim();
  if (!raw) return null;
  const key = normalize(raw);
  if (!key) return null;

  if (["metro manila", "ncr", "metro manila ncr", "national capital region"].includes(key)) {
    return (location) => {
      if (!location) return false;
      const text = normalize(location);
      if (mentionsNcr(text)) return true;
      return NCR_CITY_NAMES.some((name) => {
        const cityKey = normalize(name);
        if (AMBIGUOUS_NCR_NAMES.has(cityKey)) return hasPhrase(text, `${cityKey} city`);
        return cityPhrases(cityKey === "quezon city" ? "quezon" : cityKey).some((phrase) => hasPhrase(text, phrase));
      });
    };
  }

  const cityKey = ncrCityKey(raw);
  if (cityKey) {
    const phrases = cityPhrases(cityKey);
    return (location) => {
      if (!location) return false;
      const text = normalize(location);
      const scope = stripMetroManila(text);
      if (AMBIGUOUS_NCR_NAMES.has(cityKey)) {
        return hasPhrase(scope, `${cityKey} city`) || (mentionsNcr(text) && hasPhrase(scope, cityKey));
      }
      return phrases.some((phrase) => hasPhrase(scope, phrase));
    };
  }

  const aliases = PROVINCE_ALIASES[key];
  if (aliases) {
    return (location) => {
      if (!location) return false;
      const text = normalize(location);
      if (key === "quezon province") return hasPhrase(text, "quezon province") || (hasPhrase(text, "quezon") && !hasPhrase(text, "quezon city"));
      return aliases.some((alias) => hasPhrase(text, alias));
    };
  }

  return (location) => Boolean(location) && normalize(location as string).includes(key);
};

export const matchesJobLocation = (location: string | null | undefined, filter?: string | null): boolean => {
  const matcher = buildLocationMatcher(filter);
  return matcher ? matcher(location) : true;
};

/**
 * Prisma `mrf` condition for a monthly salary filter, in pesos. The job's whole stated
 * range must sit inside the range asked for: its lowest pay is at least the minimum and
 * its highest pay is at most the maximum, so every card shown is inside what was typed.
 * A bound the job does not state ("From ₱20,000" has no top) cannot meet a filter on that
 * bound, and jobs with no salary at all are left out whenever a salary filter is on.
 */
export const buildSalaryMrfFilter = (salaryMin?: number, salaryMax?: number) => {
  const hasMin = salaryMin !== undefined && Number.isFinite(salaryMin) && salaryMin > 0;
  const hasMax = salaryMax !== undefined && Number.isFinite(salaryMax) && salaryMax > 0;
  if (!hasMin && !hasMax) return undefined;

  const conditions: any[] = [];
  if (hasMin) conditions.push({ salaryRangeMin: { gte: salaryMin } });
  if (hasMax) conditions.push({ salaryRangeMax: { gt: 0, lte: salaryMax } });
  return { is: { AND: conditions } };
};
