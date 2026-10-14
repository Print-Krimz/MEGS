import { getManilaToday, isValidDateOnly } from "./field-limits";
import { validatePhilippinePhone } from "./phone-utils";

/**
 * Detects programming code, script injection, markup tags, and shell/SQL syntax
 * to prevent arbitrary code from being entered into human-readable text fields.
 */
export function isCodeOrScript(raw?: string | null): boolean {
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
}

/**
 * Validates a person's legal name (First Name, Middle Name, Last Name, Emergency Contact Name, Reference Name).
 * Only allows letters, spaces, hyphens, apostrophes, and periods (for initials/suffixes).
 */
export function validatePersonName(
  val?: string | null,
  label = "Name",
  options: number | { required?: boolean; maxLength?: number } = {}
): string | null {
  const opts = typeof options === "number" ? { maxLength: options } : options;
  if (!val || val.trim() === "") {
    if (opts.required) return `${label} is required`;
    return null;
  }

  const clean = val.trim();
  const max = opts.maxLength || 100;

  if (clean.length > max) {
    return `${label} cannot exceed ${max} characters`;
  }

  if (isCodeOrScript(clean)) {
    return `${label} cannot contain programming code or scripts`;
  }

  if (/[\r\n]/.test(val)) {
    return `${label} must be on a single line`;
  }

  if (/\d/.test(clean)) {
    return `${label} should not contain numbers`;
  }

  // Allow letters (including international/accented), spaces, hyphens, apostrophes, and periods
  if (!/^[a-zA-ZÀ-ÖØ-öø-ÿĀ-žÑñ\s.'’\-]+$/.test(clean)) {
    return `${label} should only contain letters, spaces, hyphens, apostrophes, and periods`;
  }

  // Must contain at least one letter
  if (!/[a-zA-ZÀ-ÖØ-öø-ÿĀ-žÑñ]/.test(clean)) {
    return `${label} must contain at least one letter`;
  }

  return null;
}

/**
 * Validates standard single-line text fields (Religion, Place of Birth, Nationality, Relationship, Company, School, Degree, Field of Study, Job Title).
 */
export function validateStandardText(
  val?: string | null,
  label = "Field",
  options: number | { required?: boolean; maxLength?: number; allowNumbers?: boolean } = {}
): string | null {
  const opts = typeof options === "number" ? { maxLength: options } : options;
  if (!val || val.trim() === "") {
    if (opts.required) return `${label} is required`;
    return null;
  }

  const clean = val.trim();
  const max = opts.maxLength || 100;

  if (clean.length > max) {
    return `${label} cannot exceed ${max} characters`;
  }

  if (isCodeOrScript(clean)) {
    return `${label} cannot contain programming code or scripts`;
  }

  if (/[\r\n]/.test(val)) {
    return `${label} must be on a single line`;
  }

  if (/[{}<>;=`~$^*|\\]/.test(clean)) {
    return `${label} contains invalid characters (no code or syntax symbols allowed)`;
  }

  return null;
}

/**
 * Validates street and residential address strings.
 */
export function validateAddressText(
  val?: string | null,
  label = "Address",
  options: { required?: boolean; maxLength?: number } = {}
): string | null {
  if (!val || val.trim() === "") {
    if (options.required) return `${label} is required`;
    return null;
  }

  const clean = val.trim();
  const max = options.maxLength || 500;

  if (clean.length > max) {
    return `${label} cannot exceed ${max} characters`;
  }

  if (isCodeOrScript(clean)) {
    return `${label} cannot contain programming code or scripts`;
  }

  if (/[\r\n]/.test(val)) {
    return `${label} must be on a single line`;
  }

  if (/[{}<>;=`~$^%*|\\]/.test(clean)) {
    return `${label} contains invalid characters (no code or syntax symbols allowed)`;
  }

  return null;
}

/**
 * Validates multi-line descriptive text (Professional Summary, Notes, Reasons).
 */
export function validateProseText(
  val?: string | null,
  label = "Summary",
  options: number | { required?: boolean; maxLength?: number } = {}
): string | null {
  const opts = typeof options === "number" ? { maxLength: options } : options;
  if (!val || val.trim() === "") {
    if (opts.required) return `${label} is required`;
    return null;
  }

  const clean = val.trim();
  const max = opts.maxLength || 5000;

  if (clean.length > max) {
    return `${label} cannot exceed ${max} characters`;
  }

  if (isCodeOrScript(clean)) {
    return `${label} must be written in natural language, not programming source code or scripts`;
  }

  return null;
}

/**
 * Sanitizes input strings by replacing newlines and tabs with standard spaces.
 */
export function sanitizeSingleLineText(val: string): string {
  if (!val) return "";
  return val.replace(/[\r\n\t]+/g, " ");
}

/**
 * Strips non-name characters in real-time.
 */
export function sanitizeNameInput(val: string): string {
  if (!val) return "";
  return val.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿĀ-žÑñ\s.'’\-]/g, "").replace(/[\r\n\t]+/g, " ");
}

/**
 * Strips all non-digit characters and formats into Philippine SSS standard: XX-XXXXXXX-X (10 digits).
 */
export function formatSSSNumber(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 2) return digits;
  if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 9)}-${digits.slice(9, 10)}`;
}

/**
 * Strips all non-digit characters and formats into Philippine PhilHealth standard: XX-XXXXXXXXX-X (12 digits).
 */
export function formatPhilHealthNumber(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 2) return digits;
  if (digits.length <= 11) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 11)}-${digits.slice(11, 12)}`;
}

/**
 * Strips all non-digit characters and formats into Philippine Pag-IBIG / HDMF standard: XXXX-XXXX-XXXX (12 digits).
 */
export function formatPagIbigNumber(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
}

/**
 * Strips all non-digit characters and formats into Philippine BIR TIN standard: XXX-XXX-XXX or XXX-XXX-XXX-XXX (9 or 12 digits).
 */
export function formatTINNumber(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9, 12)}`;
}

/**
 * Validates Philippine SSS Number. Must be empty or exactly 10 digits.
 */
export function validateSSSNumber(val?: string | null): string | null {
  if (!val || val.trim() === "") return null;
  const digits = val.replace(/\D/g, "");
  if (digits.length !== 10) {
    return "SSS number must be exactly 10 digits (00-0000000-0)";
  }
  return null;
}

/**
 * Validates Philippine PhilHealth PIN. Must be empty or exactly 12 digits.
 */
export function validatePhilHealthNumber(val?: string | null): string | null {
  if (!val || val.trim() === "") return null;
  const digits = val.replace(/\D/g, "");
  if (digits.length !== 12) {
    return "PhilHealth PIN must be exactly 12 digits (00-000000000-0)";
  }
  return null;
}

/**
 * Validates Philippine Pag-IBIG MID. Must be empty or exactly 12 digits.
 */
export function validatePagIbigNumber(val?: string | null): string | null {
  if (!val || val.trim() === "") return null;
  const digits = val.replace(/\D/g, "");
  if (digits.length !== 12) {
    return "Pag-IBIG MID must be exactly 12 digits (0000-0000-0000)";
  }
  return null;
}

/**
 * Validates Philippine BIR TIN Number. Must be empty or 9 to 12 digits.
 */
export function validateTINNumber(val?: string | null): string | null {
  if (!val || val.trim() === "") return null;
  const digits = val.replace(/\D/g, "");
  if (digits.length < 9 || (digits.length > 9 && digits.length < 12) || digits.length > 12) {
    return "TIN must be 9 or 12 digits (000-000-000 or 000-000-000-000)";
  }
  return null;
}

/**
 * Validates candidate / employee date of birth.
 */
export function validateDateOfBirth(
  val?: string | null,
  options: { required?: boolean; minAge?: number; maxAge?: number } = { minAge: 18, maxAge: 100 }
): string | null {
  if (!val || val.trim() === "") {
    if (options.required) return "Date of birth is required";
    return null;
  }

  const clean = val.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return "Enter a valid date (YYYY-MM-DD)";
  }

  if (clean < "1900-01-01") {
    return "Date of birth must be after 1900";
  }

  const today = getManilaToday();
  if (clean > today) {
    return "Date of birth cannot be in the future";
  }

  if (!isValidDateOnly(clean)) {
    return "Enter a valid date (YYYY-MM-DD)";
  }

  const [birthYear, birthMonth, birthDay] = clean.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = today.split("-").map(Number);

  let age = currentYear - birthYear;
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1;
  }

  if (options.minAge !== undefined && age < options.minAge) {
    return `Candidate must be at least ${options.minAge} years old (calculated age: ${age})`;
  }

  if (options.maxAge !== undefined && age > options.maxAge) {
    return `Age cannot exceed ${options.maxAge} years`;
  }

  return null;
}

/**
 * Validates Philippine contact mobile phone number. Strictly requires 11 digits starting with 09.
 */
export function validatePhilippineContactPhone(
  val?: string | null,
  options: string | { required?: boolean; label?: string } = {}
): string | null {
  const opts = typeof options === "string" ? { label: options } : options;
  const label = opts.label || "Contact phone";

  if (!val || val.trim() === "") {
    if (opts.required) return opts.label ? `${opts.label} is required` : "Contact phone number is required";
    return null;
  }

  let digits = val.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.startsWith("9") && digits.length === 10) {
    digits = `0${digits}`;
  }

  if (!/^09\d{9}$/.test(digits)) {
    if (!digits.startsWith("09")) {
      return `${label} must start with 09 (e.g. 0917-123-4567)`;
    }
    return `${label} must be exactly 11 digits (${digits.length}/11 digits entered)`;
  }

  return null;
}

/**
 * Validates Philippine emergency contact phone (mobile or landline).
 */
export function validateEmergencyPhone(val?: string | null, options: { required?: boolean } = {}): string | null {
  if (!val || val.trim() === "") {
    if (options.required) return "Emergency contact phone is required";
    return null;
  }

  const res = validatePhilippinePhone(val);
  if (!res.isValid) {
    return res.message || "Enter a valid contact phone number (7 to 11 digits)";
  }

  return null;
}
