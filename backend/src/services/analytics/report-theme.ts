export type ReportType = "PIPELINE" | "DEPLOYMENT" | "AUDIT";
export type ReportRoleScope = "TALENT_ACQUISITION" | "ADMINISTRATOR";

export interface ReportMetadataOptions {
  reportType: ReportType;
  roleScope: ReportRoleScope;
  requestedByEmail: string;
  filterSummary: string;
  fixedDate?: Date;
  serialSeed?: string;
}

export interface ReportMetadata {
  reportType: ReportType;
  roleScope: ReportRoleScope;
  documentCode: string;
  reportTitle: string;
  roleBadge: string;
  classification: string;
  organization: string;
  division: string;
  generatedAtFormatted: string;
  requestedByEmail: string;
  filterSummary: string;
  suggestedFilenameBase: string;
}

export const HR_THEME = {
  colors: {
    primaryNavy: "#0F172A", // Slate 900
    secondarySlate: "#334155", // Slate 700
    accentTeal: "#0F766E", // Teal 700
    tableHeaderFill: "#1E293B", // Slate 800
    tableHeaderText: "#FFFFFF",
    tableBorder: "#CBD5E1", // Slate 300
    zebraRowFill: "#F8FAFC", // Slate 50
    whiteRowFill: "#FFFFFF",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    kpiCardFill: "#F1F5F9",
    kpiCardBorder: "#E2E8F0",
  },
  fonts: {
    titleSize: 13,
    subtitleSize: 8,
    headingSize: 10,
    bodySize: 8,
    badgeSize: 7,
    kpiValueSize: 13,
    kpiLabelSize: 7,
    footerSize: 7,
  },
};

export const getStatusBadgeTheme = (statusStr: string): { bg: string; text: string } => {
  const s = (statusStr || "").toUpperCase();

  if (s.includes("HIRED") || s.includes("DEPLOYED") || s.includes("PASS") || s.includes("SUCCESS") || s.includes("RESOLVED")) {
    return { bg: "#DCFCE7", text: "#166534" }; // emerald
  }
  if (s.includes("SCREEN") || s.includes("INTERVIEW") || s.includes("SHORTLIST") || s.includes("ENDORSE") || s.includes("ACTIVE")) {
    return { bg: "#DBEAFE", text: "#1E40AF" }; // blue
  }
  if (s.includes("PENDING") || s.includes("HOLD") || s.includes("REVIEW") || s.includes("SUBMITTED")) {
    return { bg: "#FEF3C7", text: "#92400E" }; // amber
  }
  if (s.includes("REJECT") || s.includes("FAIL") || s.includes("TERMINAT") || s.includes("REVOK") || s.includes("DELETE")) {
    return { bg: "#FFE4E6", text: "#9F1239" }; // rose
  }
  return { bg: "#F1F5F9", text: "#334155" }; // neutral slate
};

export function getReportMetadata(opts: ReportMetadataOptions): ReportMetadata {
  const now = opts.fixedDate || new Date();
  // Manila calendar date, so a report generated at 7am on the 14th is not stamped the 13th.
  const dateHyphenated = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);
  const yyyymmdd = dateHyphenated.replace(/-/g, "");
  const rand = opts.serialSeed || Math.random().toString(36).substring(2, 6).toUpperCase();

  let codePrefix = "MEGS";
  let typeCode = "REP";
  let title = "MEGS RECRUITMENT REPORT";
  let filenameBase = "MEGS_Report";

  if (opts.roleScope === "TALENT_ACQUISITION") {
    codePrefix = "MEGS-TA";
    if (opts.reportType === "PIPELINE") {
      typeCode = "PIP";
      title = "MEGS — Applicant Progress Report (Recruiter)";
      filenameBase = `MEGS_TA_Candidate_Pipeline_Report_${dateHyphenated}`;
    } else if (opts.reportType === "DEPLOYMENT") {
      typeCode = "DEP";
      title = "MEGS — Worker Start Report (Recruiter)";
      filenameBase = `MEGS_TA_Deployment_Report_${dateHyphenated}`;
    }
  } else {
    codePrefix = "MEGS-ADM";
    if (opts.reportType === "PIPELINE") {
      typeCode = "PIP";
      title = "MEGS — Applicant Progress Report (Admin)";
      filenameBase = `MEGS_Admin_Workforce_Pipeline_Report_${dateHyphenated}`;
    } else if (opts.reportType === "DEPLOYMENT") {
      typeCode = "DEP";
      title = "MEGS — Worker Start Report (Admin)";
      filenameBase = `MEGS_Admin_Deployment_Governance_${dateHyphenated}`;
    } else if (opts.reportType === "AUDIT") {
      typeCode = "AUD";
      title = "MEGS — Security Audit Report";
      filenameBase = `MEGS_Admin_Security_Audit_${dateHyphenated}`;
    }
  }

  const documentCode = `${codePrefix}-${typeCode}-${yyyymmdd}-${rand}`;
  const classification =
    opts.roleScope === "ADMINISTRATOR"
      ? "CONFIDENTIAL — ADMIN ONLY"
      : "CONFIDENTIAL — MEGS STAFF ONLY";

  const roleBadge =
    opts.roleScope === "ADMINISTRATOR"
      ? "Admin (whole team)"
      : "Recruiter (own records)";

  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Manila",
  }).format(now) + " PHT";

  return {
    reportType: opts.reportType,
    roleScope: opts.roleScope,
    documentCode,
    reportTitle: title,
    roleBadge,
    classification,
    organization: "MAR EMPLOYMENT AND SERVICES (MEGS)",
    division: "Human Resources & Talent Management",
    generatedAtFormatted: formattedDate,
    requestedByEmail: opts.requestedByEmail,
    filterSummary: opts.filterSummary || "All records",
    suggestedFilenameBase: filenameBase,
  };
}
