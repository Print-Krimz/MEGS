// Reads a client company document (PDF, Word or photo) for the batch "Load clients from files" screen.
// Writes nothing and keeps no file: it returns the values it could read and a note for every field the TA should check.
import { validateDocumentBytes } from "../../security/file-validation.js";
import {
  classifyExtractionError,
  CLIENT_FIELD_KEYS,
  extractClientDataFromBuffer,
  extractClientDataFromText,
  type ClientFieldKey,
} from "../../utils/gemini.js";
import { optionalPersonNameSchema } from "../../schemas/field-limits.js";
import { taSchema } from "../../schemas/ta.schema.js";
import { validateStructuredAddress } from "../../utils/address-validation.js";
import { readDocumentWith } from "./document-read.js";

export type ClientFieldIssue = "missing" | "invalid" | "uncertain";

export type ClientReadFields = { [K in ClientFieldKey]?: string };

export interface ClientReadResult {
  status: "SUCCESS" | "UNREADABLE";
  fields: ClientReadFields;
  issues: Partial<Record<ClientFieldKey, ClientFieldIssue>>;
}

const UNCERTAIN_BELOW = 0.6;
const ADDRESS_PARTS = ["province", "city", "barangay", "postalCode"] as const;

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && ["", "null", "n/a", "none"].includes(value.trim().toLowerCase()));

// The create-client form's own rules, so a value accepted here is accepted when the TA saves.
const createRules = taSchema.createClient.shape.body.shape;
const rules: Record<ClientFieldKey, { safeParse: (value: unknown) => { success: boolean; data?: unknown } }> = {
  name: createRules.name,
  tradeName: createRules.tradeName,
  industry: createRules.industry,
  contactFirstName: optionalPersonNameSchema("First name"),
  contactLastName: optionalPersonNameSchema("Last name"),
  contactEmail: createRules.contactEmail,
  contactPhone: createRules.contactPhone,
  street: createRules.street,
  barangay: createRules.barangay,
  city: createRules.city,
  province: createRules.province,
  postalCode: createRules.postalCode,
};

/** Turns what Gemini returned into form values plus a note for every field to check. Pure: no I/O. */
export const mapClientReading = (raw: Record<string, unknown>): ClientReadResult => {
  const confidence = (raw.confidence && typeof raw.confidence === "object" ? raw.confidence : {}) as Record<string, unknown>;
  const fields: ClientReadFields = {};
  const issues: Partial<Record<ClientFieldKey, ClientFieldIssue>> = {};

  for (const key of CLIENT_FIELD_KEYS) {
    const value = raw[key];
    if (isBlank(value)) continue;
    const parsed = typeof value === "string" ? rules[key].safeParse(value.trim()) : { success: false };
    if (!parsed.success || typeof parsed.data !== "string" || !parsed.data) {
      issues[key] = "invalid";
      continue;
    }
    fields[key] = parsed.data;
    const score = confidence[key];
    if (typeof score === "number" && score < UNCERTAIN_BELOW) issues[key] = "uncertain";
  }

  // The client form accepts Philippine mobile numbers only (09XXXXXXXXX, +63 9XX, 9XX), so a landline would block the row.
  if (fields.contactPhone !== undefined) {
    const digits = fields.contactPhone.replace(/\D/g, "");
    if (!/^(09\d{9}|639\d{9}|9\d{9})$/.test(digits)) {
      delete fields.contactPhone;
      issues.contactPhone = "invalid";
    }
  }

  // The address parts only make sense together (city must belong to the province, and so on).
  if (ADDRESS_PARTS.some((key) => fields[key] !== undefined)) {
    try {
      validateStructuredAddress({
        street: fields.street, province: fields.province, city: fields.city,
        barangay: fields.barangay, postalCode: fields.postalCode,
      });
    } catch {
      for (const key of ADDRESS_PARTS) {
        if (fields[key] !== undefined || issues[key] === "invalid") issues[key] = "invalid";
        delete fields[key];
      }
    }
  }

  if (fields.name === undefined && !issues.name) issues.name = "missing";
  return { status: Object.keys(fields).length > 0 ? "SUCCESS" : "UNREADABLE", fields, issues };
};

const UNREADABLE: ClientReadResult = { status: "UNREADABLE", fields: {}, issues: {} };

/** Throws only when the file itself is not a supported document. Any reading failure returns UNREADABLE. */
export const readClientDocument = async (file: Express.Multer.File): Promise<ClientReadResult> => {
  const validated = validateDocumentBytes(file.buffer, file.mimetype);
  try {
    return mapClientReading(await readDocumentWith(
      file.buffer, validated.mimeType,
      { fromText: extractClientDataFromText, fromBuffer: extractClientDataFromBuffer }, "Client Read"));
  } catch (error: any) {
    console.warn(`[Client Read] Could not read the file (${classifyExtractionError(error)}).`);
    return { ...UNREADABLE };
  }
};
