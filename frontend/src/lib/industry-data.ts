/**
 * Comprehensive standard Philippine Industry / Sector classifications.
 * Used across client onboarding, requisition tracking, and industry sector filtering.
 */
export const PHILIPPINE_INDUSTRY_SECTORS = [
  "Manufacturing & Production",
  "Warehousing, Logistics & Supply Chain",
  "Construction, Heavy Equipment & Engineering",
  "Information Technology & BPO / Call Center",
  "Food & Beverage Processing & Services",
  "Hospitality, Hotel & Restaurant Operations",
  "Retail, Wholesale & Merchandising",
  "Facilities Management & Janitorial Services",
  "Healthcare, Medical & Pharmaceuticals",
  "Security, Safety & Protective Services",
  "Banking, Financial Services & Insurance",
  "Agriculture, Agri-Business & Fisheries",
  "Automotive & Transport Operations",
  "Energy, Power & Utilities",
  "Telecommunications & Network Infrastructure",
  "Education & Training Institutions",
  "General Commercial & Corporate Services",
] as const;

export type PhilippineIndustrySector = (typeof PHILIPPINE_INDUSTRY_SECTORS)[number];
