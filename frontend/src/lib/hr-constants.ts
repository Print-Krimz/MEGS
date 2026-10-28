/**
 * Standard HR Constants, Clearance Document Templates,
 * Demographics, and Educational Attainment Levels
 */

export interface CompliancePreset {
  label: string;
  category: "STATUTORY" | "MEDICAL" | "LEGAL" | "ACADEMIC" | "EMPLOYMENT";
  description?: string;
  defaultRequired?: boolean;
}

export const COMPLIANCE_201_PRESETS: CompliancePreset[] = [
  {
    label: "NBI / Police Clearance",
    category: "LEGAL",
    description: "NBI Clearance or PNP Police Clearance Certificate (valid within 6 months)",
    defaultRequired: true,
  },
  {
    label: "Barangay Clearance",
    category: "LEGAL",
    description: "Barangay Certificate of Residency & Good Moral Character",
    defaultRequired: false,
  },
  {
    label: "SSS Static / E-1 Form",
    category: "STATUTORY",
    description: "Social Security System E-1 / Static Info Verification",
    defaultRequired: true,
  },
  {
    label: "PhilHealth Member Data Record (MDR)",
    category: "STATUTORY",
    description: "PhilHealth MDR with validated PIN Number",
    defaultRequired: true,
  },
  {
    label: "Pag-IBIG Member ID (MID) Form",
    category: "STATUTORY",
    description: "Pag-IBIG / HDMF Member Identification Document",
    defaultRequired: true,
  },
  {
    label: "BIR Form 1902 / 2316",
    category: "STATUTORY",
    description: "TIN Registration / Certificate of Compensation Payment",
    defaultRequired: true,
  },
  {
    label: "5-Panel Drug Test Certificate",
    category: "MEDICAL",
    description: "DOH-Accredited 5-Panel Diagnostic Drug Screen",
    defaultRequired: true,
  },
  {
    label: "Fit-to-Work Medical Certificate",
    category: "MEDICAL",
    description: "Pre-employment Medical Examination & Physician Clearance",
    defaultRequired: true,
  },
  {
    label: "Transcript of Records (TOR)",
    category: "ACADEMIC",
    description: "Official Certified True Copy of Academic Records",
    defaultRequired: false,
  },
  {
    label: "College / High School Diploma",
    category: "ACADEMIC",
    description: "Copy of Graduation Diploma / Certificate of Completion",
    defaultRequired: false,
  },
  {
    label: "Certificate of Employment (COE)",
    category: "EMPLOYMENT",
    description: "Previous Employer Certificate of Employment with tenure dates",
    defaultRequired: false,
  },
  {
    label: "Driver's License (Professional)",
    category: "LEGAL",
    description: "LTO Professional Driver's License with appropriate restriction codes",
    defaultRequired: false,
  },
  {
    label: "PRC Board License",
    category: "LEGAL",
    description: "Professional Regulation Commission License ID Card",
    defaultRequired: false,
  },
  {
    label: "TESDA NC II Certificate",
    category: "ACADEMIC",
    description: "Technical Education & Skills Development Authority National Certificate",
    defaultRequired: false,
  },
];

export interface RequirementCategoryGroup {
  id: string;
  title: string;
  items: CompliancePreset[];
}

export const REQUIREMENT_GROUPS: RequirementCategoryGroup[] = [
  {
    id: "government",
    title: "Government Documents",
    items: COMPLIANCE_201_PRESETS.filter(
      (p) => p.category === "STATUTORY" || p.category === "LEGAL"
    ),
  },
  {
    id: "medical",
    title: "Medical Clearances",
    items: COMPLIANCE_201_PRESETS.filter((p) => p.category === "MEDICAL"),
  },
  {
    id: "credentials",
    title: "Education & Credentials",
    items: COMPLIANCE_201_PRESETS.filter(
      (p) => p.category === "ACADEMIC" || p.category === "EMPLOYMENT"
    ),
  },
];

export const EMPLOYMENT_TYPE_OPTIONS = [
  "Full-Time",
  "Contractual",
  "Project-Based",
  "Part-Time",
  "Casual / Temporary",
  "Seasonal",
  "Probationary",
] as const;

export const WORK_ARRANGEMENT_OPTIONS = [
  "On-site",
  "Remote",
  "Hybrid",
] as const;

export const RELATIONSHIP_PRESETS = [
  "Spouse",
  "Parent",
  "Father",
  "Mother",
  "Sibling",
  "Brother",
  "Sister",
  "Child",
  "Son",
  "Daughter",
  "Relative",
  "Guardian",
  "Colleague / Peer",
  "Former Supervisor",
  "Team Lead / Manager",
  "Professor / Dean",
  "HR Officer",
  "Friend",
  "Other",
] as const;

export const EDUCATION_DEGREE_PRESETS = [
  "High School Diploma",
  "Senior High School (K-12)",
  "Vocational / TESDA NC II",
  "Associate Degree",
  "Bachelor's Degree",
  "Post-Graduate Diploma",
  "Master's Degree",
  "Doctorate / Ph.D.",
] as const;

export const MRF_EDUCATION_OPTIONS = [
  "No minimum education required",
  "High School / Senior High School Graduate",
  "Vocational / Technical Course (TESDA)",
  "Associate Degree",
  "Bachelor's Degree / College Graduate",
  "Postgraduate / Master's Degree",
] as const;

export const MRF_EXPERIENCE_OPTIONS = [
  "No experience required (Entry-level)",
  "1 year of relevant experience",
  "2 years of relevant experience",
  "3–5 years of relevant experience",
  "5+ years of relevant experience",
] as const;

export const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-Binary",
  "Prefer not to say",
] as const;

export const CIVIL_STATUS_OPTIONS = [
  "Single",
  "Married",
  "Widowed",
  "Separated",
  "Divorced",
] as const;

export const RELIGION_OTHER = "Other (Please Specify)";

export const RELIGION_OPTIONS: string[] = [
  "Roman Catholic",
  "Protestant",
  "Iglesia ni Cristo",
  "Islam",
  "Seventh-day Adventist",
  "Born Again Christian",
  "Aglipayan (Philippine Independent Church)",
  "Buddhism",
  "Hinduism",
  RELIGION_OTHER,
  "Prefer Not to Say",
];

/**
 * Splits a stored religion string into the dropdown selection and the
 * "Please specify" text. Legacy free-text values are shown as Other + text.
 */
export function splitReligion(value: string): { selected: string; other: string } {
  if (!value || !value.trim()) return { selected: "", other: "" };
  const needle = value.trim().toLowerCase();
  const match = RELIGION_OPTIONS.find((opt) => opt.toLowerCase() === needle);
  if (match) return { selected: match, other: "" };
  return { selected: RELIGION_OTHER, other: value };
}

/**
 * Builds the single stored religion string from the dropdown selection and
 * the "Please specify" text.
 */
export function joinReligion(selected: string, other: string): string {
  if (selected === RELIGION_OTHER) return other.trim() || RELIGION_OTHER;
  return selected;
}

export function formatPresetOption(val: string): { value: string; label: string } {
  return { value: val, label: val };
}
