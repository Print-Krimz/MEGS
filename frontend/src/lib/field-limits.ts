export const FIELD_LIMITS = {
  name: 100,
  barangay: 100,
  shortText: 200,
  address: 500,
  email: 254,
  search: 200,
  label: 100,
  notes: 2_000,
  summary: 5_000,
  longText: 10_000,
  url: 2_048,
  skills: 50,
  records: 100,
  pageSize: 100,
  integerId: 2_147_483_647,
  authToken: 16_384,
  password: 4_096,
} as const;

const normalizeFieldHint = (hint?: string) => (hint ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

export const getInputTextLimit = (hint: string | undefined, type = "text", fallback = FIELD_LIMITS.shortText): number => {
  if (type === "email") return FIELD_LIMITS.email;
  if (type === "url") return FIELD_LIMITS.url;
  if (type === "password") return FIELD_LIMITS.password;
  const field = normalizeFieldHint(hint);
  if (/email/.test(field)) return FIELD_LIMITS.email;
  if (/url|website/.test(field)) return FIELD_LIMITS.url;
  if (/contact name|first name|last name|middle name|barangay|province|city|municipality|nationality|relationship|skill|certificate number|requirement label/.test(field)) return FIELD_LIMITS.name;
  if (/company|school|provider|title|position|department|street|site|birthplace/.test(field)) return FIELD_LIMITS.shortText;
  if (/\bname\b/.test(field)) return FIELD_LIMITS.name;
  if (/address/.test(field)) return FIELD_LIMITS.address;
  if (/summary/.test(field)) return FIELD_LIMITS.summary;
  if (/notes?|reason|interview details/.test(field)) return FIELD_LIMITS.notes;
  if (/job description|mrf description|job requirements|mrf requirements|contract terms?/.test(field)) return FIELD_LIMITS.longText;
  return fallback;
};

export const getTextareaTextLimit = (hint: string | undefined, fallback = FIELD_LIMITS.notes): number => {
  const field = normalizeFieldHint(hint);
  if (/professional summary/.test(field)) return FIELD_LIMITS.summary;
  if (/job description|mrf description|job requirements|mrf requirements|requirements|contract terms?/.test(field)) return FIELD_LIMITS.longText;
  return fallback;
};

export const DATE_ONLY_MIN = "1900-01-01";
export const DATE_ONLY_MAX = "2100-12-31";

export const getManilaToday = (now = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const toManilaDateInput = (value?: string | null): string => {
  if (!value) return "";
  if (isValidDateOnly(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return getManilaToday(date);
};

export const addManilaCalendarDays = (value: string, days: number): string => {
  if (!isValidDateOnly(value) || !Number.isInteger(days)) return value;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

export const isValidDateOnly = (value: string): boolean => {
  if (!/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const isValidBoundedNumber = (raw: string, min: number, max: number, decimals = 0): boolean => {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) return false;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max && (raw.split(".")[1]?.length ?? 0) <= decimals;
};
