import { ApplicationStatus } from "../../../lib/types/enums";
import { TA_COPY } from "../../../lib/ta-copy";

export type ApplicationTab = "profile" | "interviews" | "requirements" | "activity";

export const APPLICATION_TAB_LABELS: Record<ApplicationTab, string> = {
  profile: TA_COPY.applicationDetail.tabs.profile,
  interviews: TA_COPY.applicationDetail.tabs.interviews,
  requirements: TA_COPY.applicationDetail.tabs.requirements,
  activity: TA_COPY.applicationDetail.tabs.activity,
};

/** Old links and notifications use several names for the same sections. Unknown names open Profile. */
export const normalizeApplicationTab = (tab: string | null | undefined): ApplicationTab | null => {
  if (!tab) return null;
  switch (tab) {
    case "profile":
    case "evaluation":
    case "overview":
    case "ai-score":
    case "similar":
      return "profile";
    case "interviews":
      return "interviews";
    case "requirements":
    case "compliance":
    case "endorsements":
    case "hiring":
      return "requirements";
    case "activity":
    case "history":
    case "timeline":
    case "decisions":
    case "audit":
      return "activity";
    default:
      return "profile";
  }
};

const REQUIREMENTS_ONWARD: string[] = [
  ApplicationStatus.COMPLIANCE,
  ApplicationStatus.CONTRACT_SIGNING,
  ApplicationStatus.ONBOARDING,
  ApplicationStatus.HIRED,
  ApplicationStatus.DEPLOYED,
];

/**
 * The tab that holds the next piece of work: requirements from the requirements stage on,
 * interviews while one is open or at the final interview, profile otherwise.
 */
export const defaultApplicationTab = (status: string | undefined, hasOpenInterview: boolean): ApplicationTab => {
  if (status && REQUIREMENTS_ONWARD.includes(status)) return "requirements";
  if (hasOpenInterview || status === ApplicationStatus.FINAL_INTERVIEW) return "interviews";
  return "profile";
};
