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
    label: "NBI Clearance",
    category: "LEGAL",
    description: "National Bureau of Investigation Clearance (Valid within 6 months)",
    defaultRequired: true,
  },
  {
    label: "Police Clearance",
    category: "LEGAL",
    description: "Local PNP Police Clearance Certificate",
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

export function formatPresetOption(val: string): { value: string; label: string } {
  return { value: val, label: val };
}
