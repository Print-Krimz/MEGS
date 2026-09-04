import type { ProfileSection } from "./profile-navigation";

export interface ResumeReviewSummary {
  personalFields: string[];
  workExperienceCount: number;
  educationCount: number;
  skillsCount: number;
  trainingCount: number;
  referenceCount: number;
  firstSection: ProfileSection;
  firstQualificationSection?: "experience" | "education" | "skills" | "trainings" | "references";
}
