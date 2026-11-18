import type { RequirementValidity } from "../components/ta/RequirementReviewDialog";

export const isMedicalRequirementLabel = (label?: string | null): boolean =>
  Boolean(label) && !/phil\s*health/i.test(label!) && /\bmedical\b|\bfit\s+to\s+work\b|\bhealth\b/i.test(label!);

export const defaultValidityMonthsForLabel = (
  label?: string | null,
  medicalValidityMonths = 6,
): number | null => {
  if (isMedicalRequirementLabel(label)) return medicalValidityMonths;
  if (/\bnbi\b|\bdrug\s*test\b/i.test(label ?? "")) return 12;
  if (/\bpolice\b|\bbarangay\b/i.test(label ?? "")) return 6;
  return null;
};

export const defaultValidityForLabel = (label?: string | null): RequirementValidity => {
  if (!label) return "UNKNOWN";
  const text = label.trim().toLowerCase();
  if (
    /\b(sss|phil\s*health|pag-?ibig|hdmf|bir|tin|1902|2316|tor|transcript|diploma|birth\s*cert|certificate of employment|coe|nda)\b/.test(
      text
    )
  ) {
    return "NO_EXPIRY";
  }
  if (
    isMedicalRequirementLabel(label) ||
    /\b(nbi|police|barangay|drug\s*test|driver|prc|license|clearance)\b/.test(text)
  ) {
    return "HAS_EXPIRY";
  }
  return "UNKNOWN";
};

/** Same clamping math as backend addManilaMonths (Jan 31 + 1m = Feb 28/29). */
export const addManilaCalendarMonths = (yyyyMmDd: string, months: number): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd) || !Number.isInteger(months)) return "";
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  const target = month - 1 + months;
  const targetYear = year + Math.floor(target / 12);
  const targetMonth = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
};
