// Reads a manpower request form (PDF, Word or photo) for the "Fill from MRF file" button.
// Writes nothing and keeps no file: it returns the values it could read and a note for every field the TA should check.
import { z } from "zod";
import { validateDocumentBytes } from "../../security/file-validation.js";
import { extractDocumentText, isUsableResumeText } from "../../security/document-parser.js";
import {
  classifyExtractionError,
  extractMRFDataFromBuffer,
  extractMRFDataFromText,
  MRF_FIELD_KEYS,
  type MRFFieldKey,
} from "../../utils/gemini.js";
import {
  FIELD_LIMITS,
  isValidDateOnly,
  manilaDateString,
  optionalSafeProse,
  optionalSafeText,
  safeTextSchema,
} from "../../schemas/field-limits.js";

export type MRFFieldIssue = "missing" | "invalid" | "uncertain";

export interface MRFReadFields {
  title?: string;
  description?: string;
  headcount?: number;
  location?: string;
  targetFillDate?: string;
  employmentType?: string;
  workArrangement?: string;
  requiredSkills?: string;
  requiredExperience?: string;
  requiredEducation?: string;
  requiredCertifications?: string;
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  ageMin?: number;
  ageMax?: number;
  genderPreference?: "ANY" | "MALE" | "FEMALE";
  tattooPolicy?: "ALLOWED" | "NO_VISIBLE" | "NONE";
}

export interface MRFReadResult {
  status: "SUCCESS" | "UNREADABLE";
  fields: MRFReadFields;
  issues: Partial<Record<MRFFieldKey, MRFFieldIssue>>;
}

const EMPLOYMENT_TYPES = ["Full-Time", "Contractual", "Project-Based", "Part-Time", "Casual / Temporary", "Seasonal", "Probationary"];
const WORK_ARRANGEMENTS = ["On-site", "Remote", "Hybrid"];
const GENDERS = ["ANY", "MALE", "FEMALE"] as const;
const TATTOOS = ["ALLOWED", "NO_VISIBLE", "NONE"] as const;
const UNCERTAIN_BELOW = 0.6;
/** Fields the TA must see a note on when the file does not state them. */
const IMPORTANT_FIELDS: MRFFieldKey[] = ["title", "headcount", "location"];

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && ["", "null", "n/a", "none"].includes(value.trim().toLowerCase()));

const asText = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").join(", ");
  return typeof value === "string" ? value : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\s*\d+(?:\.\d+)?\s*$/.test(value)) return Number(value);
  return undefined;
};

const textRules = {
  title: safeTextSchema("Title", FIELD_LIMITS.shortText),
  location: optionalSafeText("Location", FIELD_LIMITS.shortText),
  requiredExperience: optionalSafeText("Required experience", FIELD_LIMITS.shortText),
  requiredEducation: optionalSafeText("Required education", FIELD_LIMITS.shortText),
  description: optionalSafeProse("Description", FIELD_LIMITS.longText),
  requiredSkills: optionalSafeProse("Required skills", FIELD_LIMITS.notes),
  requiredCertifications: optionalSafeProse("Required certifications", FIELD_LIMITS.notes),
} as const;

const listed = (options: readonly string[], value: unknown): string | undefined => {
  const text = asText(value)?.trim().toLowerCase();
  return text ? options.find((option) => option.toLowerCase() === text) : undefined;
};

const whole = (value: unknown, min: number, max: number): number | undefined => {
  const number = asNumber(value);
  return number !== undefined && Number.isInteger(number) && number >= min && number <= max ? number : undefined;
};

const salary = (value: unknown): number | undefined => {
  const number = asNumber(value);
  if (number === undefined || !Number.isFinite(number) || number < 0 || number > 1_000_000) return undefined;
  return Math.round(number * 100) / 100;
};

/** Checks one raw value with the same rules as the create form. Returns undefined when the value is not acceptable. */
const checkValue = (key: MRFFieldKey, value: unknown, today: string): unknown => {
  switch (key) {
    case "title": case "location": case "requiredExperience": case "requiredEducation":
    case "description": case "requiredSkills": case "requiredCertifications": {
      const text = asText(value)?.trim();
      if (!text) return undefined;
      const parsed = (textRules[key] as z.ZodTypeAny).safeParse(text);
      return parsed.success ? text : undefined;
    }
    case "headcount": return whole(value, 1, 1000);
    case "targetFillDate": {
      const text = asText(value)?.trim();
      return text && isValidDateOnly(text) && text >= today ? text : undefined;
    }
    case "employmentType": return listed(EMPLOYMENT_TYPES, value);
    case "workArrangement": return listed(WORK_ARRANGEMENTS, value);
    case "salaryRangeMin": case "salaryRangeMax": return salary(value);
    case "ageMin": case "ageMax": return whole(value, 18, 65);
    case "genderPreference": return listed(GENDERS, value)?.toUpperCase();
    case "tattooPolicy": return listed(TATTOOS, value)?.toUpperCase();
  }
};

/** Turns what Gemini returned into form values plus a note for every field to check. Pure: no I/O. */
export const mapMRFReading = (raw: Record<string, unknown>, now = new Date()): MRFReadResult => {
  const today = manilaDateString(now);
  const confidence = (raw.confidence && typeof raw.confidence === "object" ? raw.confidence : {}) as Record<string, unknown>;
  const fields: Record<string, unknown> = {};
  const issues: Partial<Record<MRFFieldKey, MRFFieldIssue>> = {};

  for (const key of MRF_FIELD_KEYS) {
    if (isBlank(raw[key])) continue;
    const value = checkValue(key, raw[key], today);
    if (value === undefined) {
      issues[key] = "invalid";
      continue;
    }
    fields[key] = value;
    const score = asNumber(confidence[key]);
    if (score !== undefined && score < UNCERTAIN_BELOW) issues[key] = "uncertain";
  }

  // Ranges: the second value is dropped when the pair makes no sense.
  if (fields.salaryRangeMin !== undefined && fields.salaryRangeMax !== undefined && (fields.salaryRangeMin as number) > (fields.salaryRangeMax as number)) {
    delete fields.salaryRangeMax;
    issues.salaryRangeMax = "invalid";
  }
  if (fields.ageMin !== undefined && fields.ageMax !== undefined && (fields.ageMin as number) > (fields.ageMax as number)) {
    delete fields.ageMax;
    issues.ageMax = "invalid";
  }

  for (const key of IMPORTANT_FIELDS) if (fields[key] === undefined && !issues[key]) issues[key] = "missing";
  if (fields.salaryRangeMin === undefined && fields.salaryRangeMax === undefined) {
    if (!issues.salaryRangeMin) issues.salaryRangeMin = "missing";
    if (!issues.salaryRangeMax) issues.salaryRangeMax = "missing";
  }

  return {
    status: Object.keys(fields).length > 0 ? "SUCCESS" : "UNREADABLE",
    fields: fields as MRFReadFields,
    issues,
  };
};

const UNREADABLE: MRFReadResult = { status: "UNREADABLE", fields: {}, issues: {} };

const readRaw = async (buffer: Buffer, mimeType: string): Promise<Record<string, unknown>> => {
  // Word files have no vision path: Gemini rejects their MIME types as inline data.
  if (mimeType.startsWith("application/") && mimeType !== "application/pdf") {
    const text = await extractDocumentText(buffer, mimeType);
    if (!text.trim()) throw new Error("Document text is empty or unreadable");
    return extractMRFDataFromText(text);
  }
  if (mimeType === "application/pdf") {
    let text = "";
    try {
      text = await extractDocumentText(buffer, mimeType);
    } catch {
      console.warn("[MRF Read] PDF text extraction failed; trying the document directly.");
    }
    if (isUsableResumeText(text)) {
      try {
        return await extractMRFDataFromText(text);
      } catch (error: any) {
        if (error?.retryable || error?.message === "AI processing timed out") throw error;
        console.warn(`[MRF Read] Text reading failed (${classifyExtractionError(error)}); trying the document directly.`);
      }
    }
  }
  return extractMRFDataFromBuffer(buffer, mimeType);
};

/** Throws only when the file itself is not a supported document. Any reading failure returns UNREADABLE. */
export const readMRFDocument = async (file: Express.Multer.File): Promise<MRFReadResult> => {
  const validated = validateDocumentBytes(file.buffer, file.mimetype);
  try {
    return mapMRFReading(await readRaw(file.buffer, validated.mimeType));
  } catch (error: any) {
    console.warn(`[MRF Read] Could not read the file (${classifyExtractionError(error)}).`);
    return UNREADABLE;
  }
};
