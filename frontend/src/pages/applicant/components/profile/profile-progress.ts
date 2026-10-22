export type PersonalSectionId = "identity" | "background" | "address" | "summary" | "government" | "emergency" | "notes";

export const PERSONAL_SECTION_ORDER: PersonalSectionId[] = [
  "identity",
  "background",
  "address",
  "summary",
  "government",
  "emergency",
  "notes",
];

/** Fields that count toward completion, per section. Sections not listed are optional. */
export const PERSONAL_REQUIRED_FIELDS: Partial<Record<PersonalSectionId, string[]>> = {
  identity: ["firstName", "lastName", "mobileNumber", "dateOfBirth"],
  address: ["address", "province", "city", "barangay", "postalCode"],
  emergency: ["emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship"],
};

export type SectionStatus = "complete" | "incomplete" | "error" | "optional";

export interface ProfileProgress {
  percent: number;
  filled: number;
  total: number;
  sections: Record<PersonalSectionId, { status: SectionStatus; missing: number }>;
}

const hasValue = (value: unknown): boolean => String(value ?? "").trim() !== "";

export function computeProfileProgress(
  form: Record<string, unknown>,
  errors: Record<string, string>,
  sectionOf: (field: string) => string | undefined,
): ProfileProgress {
  const errorSections = new Set(Object.keys(errors).map(sectionOf).filter(Boolean));
  let filled = 0;
  let total = 0;
  const sections = {} as ProfileProgress["sections"];
  for (const id of PERSONAL_SECTION_ORDER) {
    const fields = PERSONAL_REQUIRED_FIELDS[id];
    const missing = fields ? fields.filter((f) => !hasValue(form[f])).length : 0;
    if (fields) {
      total += fields.length;
      filled += fields.length - missing;
    }
    const status: SectionStatus = errorSections.has(id)
      ? "error"
      : !fields
        ? "optional"
        : missing === 0
          ? "complete"
          : "incomplete";
    sections[id] = { status, missing };
  }
  return { percent: total ? Math.round((filled / total) * 100) : 100, filled, total, sections };
}
