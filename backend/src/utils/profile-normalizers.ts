// Pure normalizers that turn loosely formatted resume values into the exact values the profile
// save schema (applicant.schema.ts) accepts. Each returns undefined when the value is unclear.

const key = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase().replace(/[.\s]+/g, " ").trim() : "";

const GENDERS: Record<string, string> = {
  m: "Male", male: "Male", man: "Male", boy: "Male", lalaki: "Male",
  f: "Female", female: "Female", woman: "Female", girl: "Female", babae: "Female",
  "non binary": "Non-Binary", "non-binary": "Non-Binary", nonbinary: "Non-Binary", nb: "Non-Binary",
  "prefer not to say": "Prefer not to say",
};

export const normalizeGender = (value: unknown): string | undefined => GENDERS[key(value)];

const CIVIL_STATUSES: Record<string, string> = {
  single: "Single", "walang asawa": "Single", binata: "Single", dalaga: "Single", "never married": "Single",
  married: "Married", kasal: "Married", "may asawa": "Married",
  widowed: "Widowed", widow: "Widowed", widower: "Widowed", biyudo: "Widowed", biyuda: "Widowed",
  separated: "Separated", hiwalay: "Separated", "legally separated": "Separated",
  divorced: "Divorced",
};

export const normalizeCivilStatus = (value: unknown): string | undefined => CIVIL_STATUSES[key(value)];

/** Returns 09XXXXXXXXX, or undefined when the value is not one Philippine mobile number. */
export const normalizeMobileNumber = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !/^\+?[()\d .-]+$/.test(value.trim())) return undefined;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("63")) {
    if (digits.length !== 12) return undefined;
    digits = digits.slice(2);
  }
  if (/^9\d{9}$/.test(digits)) digits = `0${digits}`;
  return /^09\d{9}$/.test(digits) ? digits : undefined;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const buildDate = (year: number, month: number, day: number): string | undefined => {
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) return undefined;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1) return undefined; // e.g. 31 Feb
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/**
 * Parses YYYY, YYYY-MM, YYYY-MM-DD, "Jan 2019", "January 2019" and "Jan 5, 2019" into YYYY-MM-DD
 * (first of the month/year when the day or month is missing). No timezone math is involved.
 */
export const parseLooseDate = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  let m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[T\s])/);
  if (m) return buildDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = raw.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return buildDate(Number(m[1]), Number(m[2]), 1);
  m = raw.match(/^(\d{4})$/);
  if (m) return buildDate(Number(m[1]), 1, 1);
  m = raw.match(/^([A-Za-z]{3,9})\.?\s+(?:(\d{1,2})(?:st|nd|rd|th)?,?\s+)?(\d{4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    return month ? buildDate(Number(m[3]), month, m[2] ? Number(m[2]) : 1) : undefined;
  }
  // "19 February 2002", the day-first form common on Philippine resumes.
  m = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    return month ? buildDate(Number(m[3]), month, Number(m[1])) : undefined;
  }
  // "03/2019" (month and year) and "02/19/2002" or "19/02/2002" (only when the order is unambiguous).
  m = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) return buildDate(Number(m[2]), Number(m[1]), 1);
  m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a > 12 && b <= 12) return buildDate(Number(m[3]), b, a);
    if (b > 12 && a <= 12) return buildDate(Number(m[3]), a, b);
  }
  return undefined;
};

const roundOne = (n: number) => Math.round(n * 10) / 10;
const inRange = (cm: number) => cm >= 100 && cm <= 250;

/** Height in cm (the save schema accepts 100-250), from cm, metres or feet/inches. Unclear -> undefined. */
export const parseHeightCm = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) && inRange(value) ? roundOne(value) : undefined;
  if (typeof value !== "string") return undefined;
  const s = value.trim().toLowerCase();
  if (!s) return undefined;

  const feet = s.match(/^(\d)\s*(?:'|’|ft|feet|foot)\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|”|''|in|inch|inches)?)?$/);
  if (feet) {
    const inches = feet[2] ? Number(feet[2]) : 0;
    if (inches >= 12) return undefined;
    const cm = roundOne((Number(feet[1]) * 12 + inches) * 2.54);
    return inRange(cm) ? cm : undefined;
  }
  const metres = s.match(/^(\d(?:\.\d{1,2})?)\s*m(?:eters?|etres?)?$/);
  if (metres) {
    const cm = roundOne(Number(metres[1]) * 100);
    return inRange(cm) ? cm : undefined;
  }
  const cm = s.match(/^(\d{2,3}(?:\.\d)?)\s*(?:cm|centimeters?|centimetres?)?$/);
  if (cm) {
    const n = Number(cm[1]);
    return inRange(n) ? n : undefined;
  }
  return undefined;
};

/** Weight in kg from a number or "65 kg" / "143 lbs". Unclear -> undefined. */
export const parseWeightKg = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  if (typeof value !== "string") return undefined;
  const m = value.trim().toLowerCase().match(/^(\d{1,3}(?:\.\d+)?)\s*(kg|kgs|kilograms?|lb|lbs|pounds?)?$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  const kg = /^(lb|pound)/.test(m[2] ?? "") ? roundOne(n * 0.45359237) : n;
  return kg > 0 ? kg : undefined;
};

/** A Philippine postal code is exactly four digits, and 0000 is not one. */
export const normalizePostalCode = (value: unknown): string | undefined => {
  const s = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  return /^\d{4}$/.test(s) && s !== "0000" ? s : undefined;
};

const LABEL_VALUE = (labels: string) =>
  new RegExp(String.raw`(?:^|[\n|•])\s*(?:${labels})\s*[:\-–]\s*([^\n|]+)`, "i");
const GENDER_LABEL = LABEL_VALUE("gender|sex|kasarian");
const BIRTH_LABEL = LABEL_VALUE("date of birth|birth date|birthdate|birthday|dob|petsa ng kapanganakan");
const MOBILE_LABEL = LABEL_VALUE(String.raw`contact number|contact no\.?|mobile number|mobile no\.?|mobile|cellphone number|cellphone no\.?|cell no\.?|phone number|phone`);

const FIRST_NAME_LABEL = LABEL_VALUE("first name|given name");
const MIDDLE_NAME_LABEL = LABEL_VALUE("middle name|gitnang pangalan");
const LAST_NAME_LABEL = LABEL_VALUE("last name|surname|family name|apelyido");

const cleanName = (value: string | undefined): string | undefined => {
  const name = value?.replace(/\s+/g, " ").trim();
  return name && /^[\p{L}][\p{L} .'-]{0,59}$/u.test(name) ? name : undefined;
};

/**
 * Identity values written next to a label in the resume text ("Last Name: Reyes", "Gender: Male",
 * "Date of Birth: February 19, 2002", "Contact Number: +63 917 …"). Used to fill fields the AI reader
 * left out; never replaces what it found.
 */
export const labeledIdentity = (
  text: string,
): { firstName?: string; middleName?: string; lastName?: string; gender?: string; dateOfBirth?: string; mobileNumber?: string } => {
  const value = (pattern: RegExp) => pattern.exec(text)?.[1]?.trim();
  return {
    firstName: cleanName(value(FIRST_NAME_LABEL)),
    middleName: cleanName(value(MIDDLE_NAME_LABEL)),
    lastName: cleanName(value(LAST_NAME_LABEL)),
    gender: normalizeGender(value(GENDER_LABEL)),
    dateOfBirth: parseLooseDate(value(BIRTH_LABEL)),
    mobileNumber: normalizeMobileNumber(value(MOBILE_LABEL)),
  };
};

/**
 * The last name from the full name at the top of a resume ("RODOLFO MARC MENDOZA REYES"), given the first and
 * middle names already found. Only answers when the heading starts with exactly those names and one or two
 * words remain; otherwise undefined, so a wrong guess is never made.
 */
export const lastNameFromHeading = (text: string, firstName?: string, middleName?: string): string | undefined => {
  const words = (value: string) => value.toLowerCase().split(/\s+/).filter(Boolean);
  const heading = text.split("\n").map((line) => line.trim()).find(Boolean);
  if (!heading || !firstName || !/^[\p{L} .'-]{3,80}$/u.test(heading)) return undefined;
  const headingWords = heading.split(/\s+/);
  const known = [...words(firstName), ...words(middleName ?? "")];
  if (headingWords.length <= known.length) return undefined;
  if (!known.every((word, i) => headingWords[i].toLowerCase() === word)) return undefined;
  const rest = headingWords.slice(known.length);
  if (rest.length > (middleName ? 2 : 1)) return undefined;
  return rest.join(" ");
};
