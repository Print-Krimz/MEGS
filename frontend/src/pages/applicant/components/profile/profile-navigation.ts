import { BriefcaseBusiness, ClipboardList, LayoutDashboard, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ProfileSection = "overview" | "personal" | "qualifications" | "applications";

export const PROFILE_SECTIONS: Array<{ id: ProfileSection; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "personal", label: "Personal Info", icon: UserRound },
  { id: "qualifications", label: "Experience & Education", icon: BriefcaseBusiness },
  { id: "applications", label: "Applications", icon: ClipboardList },
];

export type LegacyProfileTab = "personal" | "documents" | "experience" | "education" | "skills" | "trainings" | "references";

export function mapLegacyProfileTab(tab?: string | null): ProfileSection | null {
  switch (tab) {
    case "personal": return "personal";
    case "documents": return "overview";
    case "experience":
    case "education":
    case "skills":
    case "trainings":
    case "references": return "qualifications";
    default: return null;
  }
}

export function parseProfileSection(section?: string | null, legacyTab?: string | null): ProfileSection {
  if (section === "overview" || section === "personal" || section === "qualifications" || section === "applications") {
    return section;
  }
  return mapLegacyProfileTab(legacyTab) || "overview";
}
