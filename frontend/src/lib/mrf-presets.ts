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

export const MRF_PARTNER_INDUSTRIES = [
  "Retail, Sales and Distribution",
  "Hotel and Restaurant",
  "Logistics",
  "Warehousing",
  "Manufacturing",
  "Gaming and Casino",
  "Corporate & Administration",
] as const;

export type MRFPartnerIndustry = (typeof MRF_PARTNER_INDUSTRIES)[number];

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
  // 1. Retail, Sales and Distribution
  {
    id: "sales-promo-merchandiser",
    label: "Sales Promo / Merchandiser",
    category: "Retail, Sales and Distribution",
    title: "Sales Promo / Retail Merchandiser",
    requiredSkills: "Visual Merchandising, Stock Inventory Replenishment, Customer Engagement, Product Sampling, Planogram Compliance, Stock Rotation (FIFO)",
    requiredExperience: "6 months to 1 year retail merchandising experience",
    requiredEducation: "High School / Senior High School Graduate",
    requiredCertifications: "Valid Health Certificate / Food Handler's Permit (if assigned to food/supermarket)",
    salaryMin: 15500,
    salaryMax: 19500,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Manages retail product displays, maintains planogram compliance, and drives active customer engagement for assigned FMCG/retail brands. Monitors product expiry dates (FIFO), restocks shelves, and prepares daily stock replenishment and inventory reports.",
  },
  {
    id: "cashier-bagger",
    label: "Cashier / Bagger",
    category: "Retail, Sales and Distribution",
    title: "Retail Cashier & Baggage Assistant",
    requiredSkills: "POS Cash Register Operation, Cash Handling & Reconciliation, Barcode Scanning, Basic Math & Change Computation, Bagging & Packing Standards, Customer Service",
    requiredExperience: "Entry-level or 6 months cashiering experience",
    requiredEducation: "High School / Senior High School Graduate",
    requiredCertifications: "None required; on-the-job POS training provided",
    salaryMin: 15500,
    salaryMax: 19000,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Processes retail customer sales transactions through Point of Sale (POS) terminals, counts cash drawers, and issues official receipts. Ensures courteous customer checkout, bags items according to retail merchandise standards, and assists with counter sanitation.",
  },
  {
    id: "brand-ambassador",
    label: "Brand Ambassador",
    category: "Retail, Sales and Distribution",
    title: "Retail Brand Ambassador & Product Demonstrator",
    requiredSkills: "Product Demonstration, Public Speaking & Presentation, Lead Generation, Interpersonal Communication, Brand Knowledge, Event Activations",
    requiredExperience: "1 year promotional marketing or brand ambassador experience",
    requiredEducation: "College Level or Senior High School Graduate",
    requiredCertifications: "Brand Representation or Sales Training Certificate preferred",
    salaryMin: 18000,
    salaryMax: 24000,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Represents corporate client brands during store activations, mall trade exhibits, and high-traffic consumer campaigns. Demonstrates product features, engages shoppers, gathers prospective customer feedback, and achieves daily engagement and sales lead targets.",
  },

  // 2. Hotel and Restaurant
  {
    id: "food-server",
    label: "Food Server / Dining Steward",
    category: "Hotel and Restaurant",
    title: "Food Server / Dining Steward",
    requiredSkills: "Table Setting & Service (FBS), Food & Beverage Order Taking, Tray Carrying, Dining Room Sanitation, POS Touchscreen Entry, Guest Hospitality",
    requiredExperience: "Entry-level to 1 year dining or banquet experience",
    requiredEducation: "High School / Senior High School Graduate or Vocational FBS",
    requiredCertifications: "TESDA Food and Beverage Services NC II preferred, Valid City Health Certificate & Food Handler's Card required",
    salaryMin: 16000,
    salaryMax: 20000,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Welcomes dining guests, takes food and beverage orders, and delivers dishes promptly following standard dining service sequence. Maintains dining floor hygiene, buses tables, coordinates with kitchen staff on special dietary requests, and assists with banquet table setups.",
  },

  // 3. Logistics
  {
    id: "delivery-driver",
    label: "Delivery Driver",
    category: "Logistics",
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
    id: "messenger",
    label: "Messenger (Motorized / Foot)",
    category: "Logistics",
    title: "Corporate Messenger (Motorized / Courier)",
    requiredSkills: "Motorcycle Riding, Metro Manila Route Navigation, Document & Parcel Dispatch, Bank Check Deposit Handling, Defensive Driving, Delivery Log Management",
    requiredExperience: "1 year corporate messenger or courier experience",
    requiredEducation: "High School / Senior High School Graduate",
    requiredCertifications: "Non-Professional or Professional Driver's License with Restriction Code 1 (Motorcycle), Clean Driving Record",
    salaryMin: 16000,
    salaryMax: 21000,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Dispatches official corporate correspondence, contracts, bank deposits, and urgent parcels between branch offices and client sites. Manages daily dispatch logs, adheres strictly to traffic regulations, and safely handles confidential documents.",
  },
  {
    id: "logistics-clerk",
    label: "Logistics Dispatch & Inventory Clerk",
    category: "Logistics",
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

  // 4. Warehousing
  {
    id: "forklift-operator",
    label: "Forklift Operator",
    category: "Warehousing",
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
    label: "Warehouse Crew",
    category: "Warehousing",
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
    id: "inventory-encoder",
    label: "Encoder / Data Entry Clerk",
    category: "Warehousing",
    title: "Warehouse & Inventory Data Encoder",
    requiredSkills: "Rapid Alphanumeric Data Entry (45+ WPM), 10-Key Numeric Pad Typing, WMS / ERP Inventory Transactions, Microsoft Excel / Google Sheets, Discrepancy Flagging",
    requiredExperience: "1 year data encoding or clerical experience",
    requiredEducation: "Associate Degree or College Level",
    requiredCertifications: "TESDA Computer Systems Servicing NC II or Microsoft Excel Certificate preferred",
    salaryMin: 17000,
    salaryMax: 22000,
    employmentType: "Full-Time",
    workArrangement: "On-site",
    description: "Inputs inbound receiving receipts, stock transfers, pick confirmations, and outbound billing transactions into the warehouse ERP/WMS database. Verifies physical count tallies against system records, investigates inventory variances, and generates daily operational reports.",
  },

  // 5. Manufacturing
  {
    id: "production-worker",
    label: "Production Worker / Assembler",
    category: "Manufacturing",
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
    id: "production-supervisor",
    label: "Production Supervisor",
    category: "Manufacturing",
    title: "Manufacturing Production Supervisor",
    requiredSkills: "Production Line Leadership, Daily Shift Output Planning, Line Balancing & Takt Time, Root Cause Analysis (5-Why / Fishbone), 5S / Kaizen Enforcement, OSHS Safety Compliance",
    requiredExperience: "3 to 5 years manufacturing line leadership experience",
    requiredEducation: "Bachelor's Degree in Industrial Engineering, Mechanical Engineering, or related field",
    requiredCertifications: "Six Sigma Green Belt or DOLE BOSH / COSH Safety Officer 2 (SO2) certification preferred",
    salaryMin: 28000,
    salaryMax: 42000,
    employmentType: "Full-Time",
    workArrangement: "On-site",
    description: "Oversees daily plant assembly operations, allocates workforce across lines, and ensures shift production quotas meet quality and safety targets. Troubleshoots line stoppages, enforces DOLE safety protocols, conducts shift endorsements, and drives 5S/continuous improvement.",
  },
  {
    id: "machine-operator",
    label: "Machine Operator",
    category: "Manufacturing",
    title: "Industrial Machine Operator",
    requiredSkills: "Machine Setup & Calibration, Preventative Machine Maintenance, CNC / PLC Console Operation, Blueprint / Work Order Reading, Precision Measuring Tools (Calipers / Gauges), Lockout / Tagout (LOTO)",
    requiredExperience: "2 years operating manufacturing machinery",
    requiredEducation: "Vocational / Technical Course (TESDA) in Machining or Mechanical Technology",
    requiredCertifications: "TESDA Machining NC II / Mechanical Drafting NC II or equivalent preferred",
    salaryMin: 18500,
    salaryMax: 26000,
    employmentType: "Full-Time",
    workArrangement: "On-site",
    description: "Sets up, calibrates, and operates industrial production machinery (such as stamping presses, injection molding, CNC, or packaging equipment) according to engineering drawings. Conducts routine lubrication and basic preventive maintenance, monitors instrument gauges, and reports mechanical anomalies.",
  },
  {
    id: "qa-inspector",
    label: "QA/QC Personnel / Inspector",
    category: "Manufacturing",
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
    id: "welder",
    label: "Welder (SMAW / GMAW)",
    category: "Manufacturing",
    title: "Certified Industrial Welder (SMAW / GMAW)",
    requiredSkills: "Shielded Metal Arc Welding (SMAW), Gas Metal Arc Welding (GMAW / MIG), Blueprint & Weld Symbol Interpretation, Metal Joint Preparation, Weld Inspection & Grinding, Hot Work Safety Standards",
    requiredExperience: "2 years structural or industrial welding experience",
    requiredEducation: "Vocational / Technical Course (TESDA)",
    requiredCertifications: "TESDA Shielded Metal Arc Welding (SMAW) NC II or GMAW NC II required",
    salaryMin: 20000,
    salaryMax: 32000,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Fabricates, joins, and repairs industrial metal assemblies and structural components using SMAW/GMAW techniques in compliance with engineering blueprints. Prepares metal edges, selects proper welding rods, inspects weld integrity for porosity or cracks, and adheres to hot work safety protocols.",
  },

  // 6. Gaming and Casino
  {
    id: "utility-helper",
    label: "Utility Helper / Steward",
    category: "Gaming and Casino",
    title: "Utility Helper & Facility Steward",
    requiredSkills: "Facility Deep Cleaning & Sanitization, Heavy Waste Segregation, Supply Cart Replenishment, Basic Facility Maintenance, Chemical Handling Safety, Fast-Paced Floor Assistance",
    requiredExperience: "Entry-level to 1 year utility or housekeeping experience",
    requiredEducation: "High School / Senior High School Graduate",
    requiredCertifications: "TESDA Housekeeping NC II preferred",
    salaryMin: 15500,
    salaryMax: 19500,
    employmentType: "Contractual",
    workArrangement: "On-site",
    description: "Maintains spotless public and backstage gaming and hospitality areas through proactive waste disposal, floor scrubbing, and restroom/lounge restocking. Follows commercial chemical handling procedures and assists staff with moving venue equipment during operational shifts.",
  },
  {
    id: "casino-floor-attendant",
    label: "Casino Floor Attendant / Cashier",
    category: "Gaming and Casino",
    title: "Casino Gaming Floor & Cage Cashier Attendant",
    requiredSkills: "Casino Cage Cashiering, Chip & Token Handling, High-Stakes Customer Courtesy, Regulatory Compliance (PAGCOR / AMLA), Dispute Escalation, Sharp Numerical Accuracy",
    requiredExperience: "1 year hospitality, cashiering, or gaming floor experience",
    requiredEducation: "College Graduate or Associate Degree",
    requiredCertifications: "PAGCOR Regulatory Gaming License / Pre-licensing accreditation preferred",
    salaryMin: 20000,
    salaryMax: 30000,
    employmentType: "Full-Time",
    workArrangement: "On-site",
    description: "Provides frontline gaming floor guest service, assists players with chip exchanges and cage transaction documentation in compliance with PAGCOR and AMLA regulations. Ensures impeccable cash drawer reconciliation, maintains quiet floor decorum, and resolves guest inquiries.",
  },

  // 7. Corporate & Administration
  {
    id: "admin-assistant",
    label: "Office Staff / Admin Assistant",
    category: "Corporate & Administration",
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
  {
    id: "customer-service",
    label: "Customer Support Representative",
    category: "Corporate & Administration",
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
];

export function getMRFPresetById(id: string): MRFRolePreset | undefined {
  return MRF_ROLE_PRESETS.find((p) => p.id === id);
}

export function getPresetsByIndustry(): Record<string, MRFRolePreset[]> {
  const grouped: Record<string, MRFRolePreset[]> = {};
  for (const industry of MRF_PARTNER_INDUSTRIES) {
    grouped[industry] = [];
  }
  for (const preset of MRF_ROLE_PRESETS) {
    if (!grouped[preset.category]) {
      grouped[preset.category] = [];
    }
    grouped[preset.category].push(preset);
  }
  return grouped;
}
