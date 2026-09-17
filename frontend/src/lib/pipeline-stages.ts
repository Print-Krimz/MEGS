import { ApplicationStatus } from "./types/enums";

/** Map legacy and intermediate application states to canonical pipeline indices. */
export const getPipelineStageIndex = (status: string): number => {
  switch (status) {
    case ApplicationStatus.SUBMITTED:
    case ApplicationStatus.PARSING:
    case ApplicationStatus.REVIEW:
    case ApplicationStatus.NEEDS_ATTENTION:
    case ApplicationStatus.MATCHED:
      return 0;
    case ApplicationStatus.INITIAL_SCREENING:
      return 1;
    case ApplicationStatus.CLIENT_ENDORSEMENT:
      return 2;
    case ApplicationStatus.FINAL_INTERVIEW:
      return 3;
    case ApplicationStatus.HIRED:
    case ApplicationStatus.COMPLIANCE:
      return 4;
    case ApplicationStatus.ONBOARDING:
    case ApplicationStatus.CONTRACT_AND_ORIENTATION:
      return 5;
    case ApplicationStatus.DEPLOYED:
      return 6;
    default:
      return -1;
  }
};
