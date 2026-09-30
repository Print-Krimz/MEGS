/**
 * Standard MRF Role Presets Catalog
 * Vetted Philippine staffing role presets and helper lookup functions.
 * Designed for deterministic, zero-AI form acceleration in Manpower Requisitions.
 */

export interface MRFRolePreset {
  id: string;
  label: string;
  category: string;
  title: string;
  requiredSkills: string;
  requiredExperience: string;
  requiredEducation: string;
  requiredCertifications: string;
  salaryMin: number;
  salaryMax: number;
  employmentType: string;
  workArrangement: string;
  description: string;
}

/**
 * Normalizes any raw skills input (JSON string array, string with brackets/quotes, comma-delimited, etc.)
 * into a clean array of string skill names.
 * Example: '["Machinery Operation", "Preventive Maintenance"]' -> ['Machinery Operation', 'Preventive Maintenance']
 */
export function parseSkillsArray(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Check if string is a JSON array e.g. ["Skill 1", "Skill 2"]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((s) => String(s).trim())
          .filter(Boolean);
      }
    } catch {
      // Regex fallback if JSON.parse fails
      return trimmed
        .replace(/^\[\s*|\s*\]$/g, "")
        .split(",")
        .map((s) => s.replace(/^["']\s*|\s*["']$/g, "").trim())
        .filter(Boolean);
    }
  }

  // Handle standard comma-separated or newline-separated string
  return trimmed
    .split(/[,;\n]/)
    .map((s) => s.replace(/^["'\[\]]\s*|\s*["'\[\]]$/g, "").trim())
    .filter(Boolean);
}

/**
 * Normalizes any raw skills data into a clean, human-readable comma-separated string.
 * Example: '["Forklift", "5S"]' -> 'Forklift, 5S'
 */
export function formatSkillsList(raw: string | string[] | null | undefined): string {
  return parseSkillsArray(raw).join(", ");
}

export const MRF_ROLE_PRESETS: MRFRolePreset[] = [
  {
    id: "forklift-operator",
    label: "Forklift Operator",
    category: "Warehousing & Logistics",
    title: "Forklift Operator (Heavy Equipment)",
    requiredSkills: "Forklift Operation (Counterbalance & Reach Truck), Warehouse Safety (OSHS), Pallet Stacking, Inventory Staging, Equipment Pre-operational Inspection",
    requiredExperience: "2 years of relevant experience",
    requiredEducation: "Vocational / Technical Course (TESDA)",
    requiredCertifications: "TESDA Heavy Equipment Operation (Forklift) NC II, Valid LTO Driver's License (Restriction Code 3 / 8)",
    salaryMin: 18000,
    salaryMax: 26000,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Responsible for safely operating counterbalance and reach forklifts to transport, load, unload, and stack warehouse materials and pallets. Conducts daily equipment pre-check inspections, adheres strictly to DOLE-OSHS warehouse safety standards, and assists with staging shipments.",
  },
  {
    id: "warehouse-associate",
    label: "Warehouse Associate",
    category: "Warehousing & Logistics",
    title: "Warehouse Associate / Material Handler",
    requiredSkills: "Material Handling, Order Picking & Packing, Barcode RF Scanning, Cycle Counting, Loading & Unloading, 5S Housekeeping",
    requiredExperience: "1 year of relevant experience",
    requiredEducation: "High School / Senior High School Graduate",
    requiredCertifications: "Basic Occupational Safety and Health (BOSH) Certification preferred",
    salaryMin: 16000,
    salaryMax: 22000,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Handles daily inbound receiving, order picking, staging, and packing of goods in accordance with fulfillment pick lists. Utilizes RF barcode scanners for real-time inventory updates, maintains clean and organized aisle staging (5S), and supports physical inventory cycle counts.",
  },
  {
    id: "production-worker",
    label: "Production Line Assembler",
    category: "Manufacturing & Assembly",
    title: "Production Line Assembler",
    requiredSkills: "Assembly Line Operation, Hand & Power Tools Handling, Product Packaging, Visual Quality Inspection, 5S Principles, Machine Safety",
    requiredExperience: "No experience required (Entry-level)",
    requiredEducation: "High School / Senior High School Graduate",
    requiredCertifications: "None required; On-the-job training provided",
    salaryMin: 15500,
    salaryMax: 20000,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Performs repetitive assembly operations, parts sorting, and final packaging along an active manufacturing line. Follows standard operating procedures (SOPs), achieves line cycle targets, ensures immediate escalation of defective raw parts, and maintains workbench safety.",
  },
  {
    id: "logistics-clerk",
    label: "Logistics Dispatch & Inventory Clerk",
    category: "Warehousing & Logistics",
    title: "Logistics Dispatch & Inventory Clerk",
    requiredSkills: "Inventory Management, Shipping Documentation (Waybill / DR / Packing List), Warehouse Management System (WMS), Microsoft Excel, Dispatch Scheduling",
    requiredExperience: "2 years of relevant experience",
    requiredEducation: "Vocational / Technical Course (TESDA)",
    requiredCertifications: "TESDA Inventory Management or Microsoft Office Specialist (MOS) preferred",
    salaryMin: 19000,
    salaryMax: 27000,
    employmentType: "Full-Time",
    workArrangement: "On-site",
    description: "Prepares and reconciles daily shipping documents including Delivery Receipts (DRs), Bills of Lading, and transfer manifests. Coordinates outbound truck dispatch schedules, performs system inventory reconciliations in WMS/ERP, and communicates shipment statuses to clients.",
  },
  {
    id: "qa-inspector",
    label: "Quality Assurance (QA) Inspector",
    category: "Quality Control",
    title: "Quality Assurance (QA) Inspector",
    requiredSkills: "Quality Control Inspection, Vernier Calipers & Micrometer Usage, Defect Sorting & Tagging, ISO 9001 Standards, Sampling Plans (AQL), Non-Conformance Reporting",
    requiredExperience: "2 years of relevant experience",
    requiredEducation: "Associate Degree",
    requiredCertifications: "Quality Control / Six Sigma Yellow Belt or ISO 9001 Awareness training preferred",
    salaryMin: 20000,
    salaryMax: 30000,
    employmentType: "Full-Time",
    workArrangement: "On-site",
    description: "Executes in-process inspection and outgoing quality audits on finished goods against customer engineering specifications and AQL sample plans. Logs non-conformance reports (NCR), segregates rejected goods, and collaborates with line supervisors to resolve recurring defects.",
  },
  {
    id: "delivery-driver",
    label: "Delivery Driver",
    category: "Transportation & Logistics",
    title: "Delivery Driver (Light to Medium Truck)",
    requiredSkills: "Commercial Truck Driving (4-Wheeler / 6-Wheeler), Route Navigation (Metro Manila & CALABARZON), Cargo Securing, Defensive Driving, Basic Vehicle Maintenance",
    requiredExperience: "2 years of relevant experience",
    requiredEducation: "High School / Senior High School Graduate",
    requiredCertifications: "Professional Driver's License with Restriction Code 2, 3 (or Condition Code A, B, C), Clean Driving Record",
    salaryMin: 18000,
    salaryMax: 26000,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Operates 4-wheel to 6-wheel commercial delivery vehicles to transport customer goods safely across urban and provincial distribution hubs. Inspects vehicle fluids and tire pressures before departure, assists with delivery unloading, and obtains signed proof of delivery (POD).",
  },
  {
    id: "customer-service",
    label: "Customer Support Representative",
    category: "BPO & Customer Service",
    title: "Customer Support Representative",
    requiredSkills: "Customer Service, Fluent English Communication (Verbal & Written), CRM Software (Zendesk / Salesforce), Ticket Resolution, Conflict De-escalation, Typing Speed 40+ WPM",
    requiredExperience: "1 year of relevant experience",
    requiredEducation: "High School / Senior High School Graduate",
    requiredCertifications: "BPO Foundations or Call Center Certification preferred",
    salaryMin: 22000,
    salaryMax: 32000,
    employmentType: "Full-Time",
    workArrangement: "Hybrid",
    description: "Provides omni-channel customer support via phone, email, and live chat to troubleshoot inquiries, resolve billing concerns, and process order changes. Meets SLA first-contact resolution metrics and delivers high customer satisfaction (CSAT) scores.",
  },
  {
    id: "admin-assistant",
    label: "Administrative & HR Assistant",
    category: "General Administration",
    title: "Administrative & HR Assistant",
    requiredSkills: "Office Administration, Calendar Management, Document Filing & Archiving, Basic HR Onboarding Support, Google Workspace / MS Office, Vendor Coordination",
    requiredExperience: "1 year of relevant experience",
    requiredEducation: "Bachelor's Degree / College Graduate",
    requiredCertifications: "Civil Service Eligibility or Administrative Professional certification preferred",
    salaryMin: 20000,
    salaryMax: 28000,
    employmentType: "Full-Time",
    workArrangement: "Hybrid",
    description: "Coordinates general office operations, front desk greeting, corporate correspondence, and supply requisitions. Supports HR Talent Acquisition with interview scheduling, pre-employment 201 filing, and manages executive meeting calendars.",
  },
];

export function getMRFPresetById(id: string): MRFRolePreset | undefined {
  return MRF_ROLE_PRESETS.find((p) => p.id === id);
}
