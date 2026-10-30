import { z } from "zod";
import { isWithinBusinessHours } from "../config/business-hours.js";

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
  newPasswordMaxBytes: 72,
} as const;

/**
 * Detects programming code, scripts, HTML injection, and shell/SQL syntax
 * to prevent arbitrary code from being submitted in human-readable text fields.
 */
export const isCodeOrScriptText = (raw?: string | null): boolean => {
  if (!raw || typeof raw !== "string") return false;
  const text = raw.trim();
  if (!text) return false;

  // 1. HTML / Script / Markup Injection
  if (/<(?:\/)?(?:script|style|iframe|object|embed|applet|svg|meta|link|form|input|button)\b[^>]*>/i.test(text)) {
    return true;
  }
  if (/\b(?:javascript|vbscript|data):/i.test(text)) {
    return true;
  }
  if (/\bon\w+\s*=\s*["']?[^"'>\s]+/i.test(text)) {
    return true;
  }

  // 2. JavaScript / TypeScript declarations & imports
  if (/\b(const|let|var)\s+[a-zA-Z_$][\w$]*\s*=/i.test(text)) {
    return true;
  }
  if (/\brequire\s*\(\s*['"][^'"]+['"]\s*\)/i.test(text)) {
    return true;
  }
  if (/\bimport\s+(?:[\w\s{},*]+)\s+from\s+['"][^'"]+['"]/i.test(text)) {
    return true;
  }
  if (/\bexport\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\b/i.test(text)) {
    return true;
  }
  if (/\bmodule\.exports\s*=/i.test(text)) {
    return true;
  }

  // 3. Functions, methods & arrow functions
  if (/\bfunction\s*[a-zA-Z_$]*\s*\([^)]*\)\s*\{/i.test(text)) {
    return true;
  }
  if (/\(?\s*(?:[a-zA-Z_$][\w$]*|\([^)]*\))\s*\)?\s*=>\s*\{?/i.test(text)) {
    return true;
  }
  if (/\bconsole\.(?:log|error|warn|info|debug|trace)\s*\(/i.test(text)) {
    return true;
  }
  if (/\b(?:app|router|server)\.(?:use|get|post|put|delete|patch|listen|all)\s*\(/i.test(text)) {
    return true;
  }
  if (/\b(?:res|req)\.(?:status|send|json|params|query|body|setHeader|cookie)\s*[\.(]/i.test(text)) {
    return true;
  }

  // 4. Class & OOP / other language constructs
  if (/\bclass\s+[a-zA-Z_$][\w$]*\s*(?:extends\s+[a-zA-Z_$][\w$]*\s*)?\{/i.test(text)) {
    return true;
  }
  if (/\bdef\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*:/i.test(text)) {
    return true;
  }
  if (/\bpublic\s+(?:static\s+)?(?:void|class|int|string|boolean|double|float)\s+[a-zA-Z_$]/i.test(text)) {
    return true;
  }

  // 5. SQL statements
  if (/\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO\s+.+\s+VALUES|DELETE\s+FROM\s+.+|DROP\s+TABLE|ALTER\s+TABLE|UNION\s+SELECT)\b/i.test(text)) {
    return true;
  }

  // 6. Multi-line code block structure: high density of code punctuation ({, }, ;, =>, //, /*)
  const codeSymbolCount = (text.match(/[;{}][\s\r\n]*/g) || []).length;
  if (codeSymbolCount >= 2 && /\b(if|else|for|while|return|switch|case|try|catch|finally|throw|new|this|typeof|async|await)\b/i.test(text)) {
    return true;
  }

  // 7. Typical JSON/object literal with line breaks and code keys
  if (/^\{\s*["']?\w+["']?\s*:\s*.+\}$/s.test(text) && text.includes("\n")) {
    return true;
  }

  return false;
};

export const boundedText = (max: number = FIELD_LIMITS.shortText) => z.string().trim().max(max);
export const optionalText = (max: number = FIELD_LIMITS.shortText) => boundedText(max).optional().nullable();
export const requiredText = (label: string, max: number = FIELD_LIMITS.shortText) =>
  z.string().trim().min(1, `${label} is required`).max(max);

export const personNameSchema = (label = "Name") =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(FIELD_LIMITS.name)
    .refine((val) => !/[\r\n]/.test(val), `${label} must be on a single line`)
    .refine((val) => !/\d/.test(val), `${label} should not contain numbers`)
    .refine((val) => /^[a-zA-ZÀ-ÖØ-öø-ÿĀ-žÑñ\s.'’\-]+$/.test(val), `${label} should only contain letters, spaces, hyphens, apostrophes, and periods`)
    .refine((val) => !isCodeOrScriptText(val), `${label} cannot contain programming code or scripts`);

export const optionalPersonNameSchema = (label = "Name") =>
  z
    .string()
    .trim()
    .max(FIELD_LIMITS.name)
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      return !/[\r\n]/.test(val) && !/\d/.test(val) && /^[a-zA-ZÀ-ÖØ-öø-ÿĀ-žÑñ\s.'’\-]+$/.test(val) && !isCodeOrScriptText(val);
    }, `${label} should only contain letters, spaces, hyphens, apostrophes, and periods (no code/numbers allowed)`);

export const safeTextSchema = (label = "Field", max: number = FIELD_LIMITS.shortText) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max)
    .refine((val) => !/[\r\n]/.test(val), `${label} must be on a single line`)
    .refine((val) => !/[{}<>;=`~$^*|\\]/.test(val), `${label} contains invalid characters (no code or syntax symbols allowed)`)
    .refine((val) => !isCodeOrScriptText(val), `${label} cannot contain programming code or scripts`);

export const optionalSafeText = (label = "Field", max: number = FIELD_LIMITS.shortText) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      return !/[\r\n]/.test(val) && !/[{}<>;=`~$^*|\\]/.test(val) && !isCodeOrScriptText(val);
    }, `${label} contains invalid characters or code`);

const hasLetter = (val: string) => /\p{L}/u.test(val);
const LETTERS_MESSAGE = "Use letters, not only numbers.";

// Safe text that must also contain at least one letter (rejects entries like "123123").
export const safeLetterTextSchema = (label = "Field", max: number = FIELD_LIMITS.shortText) =>
  safeTextSchema(label, max).refine(hasLetter, LETTERS_MESSAGE);

export const optionalSafeLetterText = (label = "Field", max: number = FIELD_LIMITS.shortText) =>
  optionalSafeText(label, max).refine((val) => !val || hasLetter(val), LETTERS_MESSAGE);

export const safeAddressSchema = (label = "Address") =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(FIELD_LIMITS.address)
    .refine((val) => !/[\r\n]/.test(val), `${label} must be on a single line`)
    .refine((val) => !/[{}<>;=`~$^%*|\\]/.test(val), `${label} contains invalid characters (no code or syntax symbols allowed)`)
    .refine((val) => !isCodeOrScriptText(val), `${label} cannot contain programming code or scripts`);

export const optionalSafeAddress = (label = "Address") =>
  z
    .string()
    .trim()
    .max(FIELD_LIMITS.address)
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      return !/[\r\n]/.test(val) && !/[{}<>;=`~$^%*|\\]/.test(val) && !isCodeOrScriptText(val);
    }, `${label} contains invalid characters or code`);

export const safeProseSchema = (label = "Text", max: number = FIELD_LIMITS.notes) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max)
    .refine((val) => !isCodeOrScriptText(val), `${label} must be written in natural language, not programming source code or scripts`);

export const optionalSafeProse = (label = "Text", max: number = FIELD_LIMITS.notes) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      return !isCodeOrScriptText(val);
    }, `${label} must be written in natural language, not programming source code or scripts`);

export const optionalSafeUrl = (label = "URL", max: number = FIELD_LIMITS.url) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      if (/[\r\n]/.test(val) || isCodeOrScriptText(val)) return false;
      try {
        const parsed = new URL(val);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, `${label} must be a valid http or https web address`)
    .transform((val) => (val?.trim() ? val.trim() : null));

export const formattedDigits = (minDigits: number, maxDigits: number) => z.string().optional().nullable().refine((value) => {
  if (!value?.trim()) return true;
  const digits = value.replace(/\D/g, "");
  return /^[\d -]+$/.test(value) && digits.length > 0 && digits.length >= minDigits && digits.length <= maxDigits;
}, `Enter ${minDigits === maxDigits ? `exactly ${maxDigits}` : `${minDigits} to ${maxDigits}`} digits using numbers, spaces, or dashes`);

export const formattedPhone = z.string().optional().nullable().refine((value) => {
  if (!value?.trim()) return true;
  if (!/^\+?[()\d .-]+$/.test(value)) return false;
  let digits = value.replace(/\D/g, "");
  if (value.trim().startsWith("+") && !digits.startsWith("63")) return false;
  if (digits.startsWith("63")) {
    if (digits.length < 9 || digits.length > 12) return false;
    digits = `0${digits.slice(2)}`;
  }
  return digits.length >= 7 && digits.length <= 11;
}, "Enter one Philippine phone number with 7 to 11 local digits").transform((value) => {
  if (!value?.trim()) return value;
  const trimmed = value.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("63")) digits = `0${digits.slice(2)}`;
  else if (digits.startsWith("9") && digits.length === 10) digits = `0${digits}`;
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^0\d{6,10}$/.test(digits)) return digits;
  return trimmed;
});

const normalizePhilippineMobile = (value: string): string | null => {
  if (!/^\+?[()\d .-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("63")) {
    if (digits.length !== 12) return null;
    digits = digits.slice(2);
  }
  if (/^9\d{9}$/.test(digits)) digits = `0${digits}`;
  return /^09\d{9}$/.test(digits) ? digits : null;
};

export const formattedMobile = z.string().optional().nullable().refine((value) => {
  if (!value?.trim()) return true;
  return normalizePhilippineMobile(value) !== null;
}, "Enter one Philippine mobile number that normalizes to 11 digits beginning with 09").transform((value) => {
  if (!value?.trim()) return value;
  return normalizePhilippineMobile(value) ?? value.trim();
});

const NUMERIC_TEXT = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

/** Rejects exponent notation, hexadecimal, whitespace, and multiple numeric values. */
export const finiteNumber = (options: {
  min: number;
  max: number;
  integer?: boolean;
  decimals?: number;
}) => z.union([z.number(), z.string()]).transform((raw, ctx) => {
  if (typeof raw === "string" && !NUMERIC_TEXT.test(raw)) {
    ctx.addIssue({ code: "custom", message: "Enter one valid number without exponent notation" });
    return z.NEVER;
  }
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value < options.min || value > options.max ||
      (options.integer && !Number.isInteger(value)) ||
      (options.decimals !== undefined && Number.isFinite(value) &&
        (raw.toString().split(".")[1]?.length ?? 0) > options.decimals)) {
    ctx.addIssue({ code: "custom", message: "Number is outside the allowed range or precision" });
    return z.NEVER;
  }
  return value;
});

export const boundedId = finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true });
export const boundedIdText = z.string().regex(/^\d{1,10}$/).refine((value) => Number(value) >= 1 && Number(value) <= FIELD_LIMITS.integerId, "ID is outside the supported range");
export const boundedPageSize = finiteNumber({ min: 1, max: FIELD_LIMITS.pageSize, integer: true });
/** Opt-in pagination query fields. Omitting both keeps the legacy full-list response. */
export const pageQueryFields = { page: boundedId.optional(), pageSize: boundedPageSize.optional() };

export const DATE_ONLY_MIN = "1900-01-01";
export const DATE_ONLY_MAX = "2100-12-31";
const DATE_ONLY_PATTERN = /^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const isValidDateOnly = (value: string): boolean => {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const dateOnly = z.string().refine(isValidDateOnly, "Enter a valid date from 1900 through 2100");

export const manilaDateString = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

/** "Oct 26, 2026" in Manila time, whatever the server time zone is. */
export const formatManilaDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" }).format(date);

/** "Oct 26, 2026, 2:30 PM" in Manila time, whatever the server time zone is. */
export const formatManilaDateTime = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

/**
 * Whole Manila calendar days from today until a due date: 0 = due today, 1 = tomorrow, -1 = one day overdue.
 * A deadline counts as met for the whole of its Manila day, so it is only overdue once the result is negative.
 */
export const manilaDaysUntil = (due: Date, now = new Date()): number =>
  Math.round((Date.parse(manilaDateString(due)) - Date.parse(manilaDateString(now))) / 86_400_000);

export const parseManilaDateOnly = (value: string): Date => {
  if (!isValidDateOnly(value)) throw new Error("Invalid calendar date");
  return new Date(`${value}T00:00:00+08:00`);
};

export const toManilaDateOnly = (value: string | Date): string => {
  if (value instanceof Date) return manilaDateString(value);
  if (isValidDateOnly(value)) return value;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Invalid calendar date");
  return manilaDateString(parsed);
};

export const isFutureDateTime = (value: string, now = Date.now()): boolean => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now;
};

/**
 * Office hours check for Manila time: Mon–Fri 9:00–17:00, Sat 9:00–12:00, closed Sunday.
 * The hours live in config/business-hours.ts.
 */
export const isWorkingHours = (dateOrIso: string | Date): boolean => isWithinBusinessHours(dateOrIso);

const ADULT_MIN_AGE = 18;
const ADULT_MAX_AGE = 100;

/** Completed years between a YYYY-MM-DD birth date and a YYYY-MM-DD "today" (both calendar dates). */
const completedYearsOn = (birthDate: string, today: string): number => {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, day] = today.split("-").map(Number);
  const hadBirthdayThisYear = month > birthMonth || (month === birthMonth && day >= birthDay);
  return year - birthYear - (hadBirthdayThisYear ? 0 : 1);
};

/**
 * Real YYYY-MM-DD date of birth for an adult applicant or candidate. Completed age must be 18 to 100
 * inclusive by default (walk-in intake narrows the upper limit to 65), measured against today's date
 * in Manila time. Callers allow "", null and absent explicitly.
 */
export const adultDateOfBirth = (label = "Applicant", maxAge = ADULT_MAX_AGE) =>
  z.string().superRefine((value, ctx) => {
    if (!isValidDateOnly(value)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date from 1900 through 2100" });
      return;
    }
    const age = completedYearsOn(value, manilaDateString());
    if (age < ADULT_MIN_AGE || age > maxAge) {
      ctx.addIssue({ code: "custom", message: `${label} must be between ${ADULT_MIN_AGE} and ${maxAge} years old.` });
    }
  });

/** Exact digit count for a Philippine government ID. Spaces and dashes are formatting only; empty values are allowed. */
const governmentIdDigits = (allowedLengths: readonly number[], message: string) =>
  z
    .string()
    .optional()
    .nullable()
    .refine((value) => {
      if (!value || value.trim() === "") return true;
      return /^[\d -]+$/.test(value) && allowedLengths.includes(value.replace(/\D/g, "").length);
    }, message);

export const sssNumber = governmentIdDigits([10], "SSS number must be 10 digits.");
export const philhealthNumber = governmentIdDigits([12], "PhilHealth number must be 12 digits.");
export const pagibigNumber = governmentIdDigits([12], "Pag-IBIG number must be 12 digits.");
export const tinNumber = governmentIdDigits([9, 12], "TIN must be 9 or 12 digits.");
