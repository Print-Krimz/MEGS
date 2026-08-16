export const Role = {
  APPLICANT: "APPLICANT",
  TALENT_ACQUISITION: "TALENT_ACQUISITION",
  ADMINISTRATOR: "ADMINISTRATOR",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ApplicationStatus = {
  SUBMITTED: "SUBMITTED",
  PARSING: "PARSING",
  REVIEW: "REVIEW",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
  MATCHED: "MATCHED",
  TALENT_POOL: "TALENT_POOL",
  INITIAL_SCREENING: "INITIAL_SCREENING",
  CLIENT_ENDORSEMENT: "CLIENT_ENDORSEMENT",
  FINAL_INTERVIEW: "FINAL_INTERVIEW",
  HIRED: "HIRED",
  ONBOARDING: "ONBOARDING", // Preserved for legacy schema compatibility
  COMPLIANCE: "COMPLIANCE",
  DEPLOYED: "DEPLOYED",
  BACKOUT: "BACKOUT",
  ARCHIVED: "ARCHIVED",
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

/**
 * Canonical recruiter-facing pipeline filter stages.
 * Excludes legacy/redundant internal states like ONBOARDING.
 */
export const PIPELINE_FILTER_STAGES: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.PARSING,
  ApplicationStatus.REVIEW,
  ApplicationStatus.NEEDS_ATTENTION,
  ApplicationStatus.MATCHED,
  ApplicationStatus.TALENT_POOL,
  ApplicationStatus.INITIAL_SCREENING,
  ApplicationStatus.CLIENT_ENDORSEMENT,
  ApplicationStatus.FINAL_INTERVIEW,
  ApplicationStatus.HIRED,
  ApplicationStatus.COMPLIANCE,
  ApplicationStatus.DEPLOYED,
  ApplicationStatus.BACKOUT,
  ApplicationStatus.ARCHIVED,
];

/**
 * Authoritative pipeline stage transitions matching backend state machine.
 */
export const ALLOWED_STAGE_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  SUBMITTED: [
    ApplicationStatus.PARSING,
    ApplicationStatus.REVIEW,
    ApplicationStatus.MATCHED,
    ApplicationStatus.NEEDS_ATTENTION,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  PARSING: [
    ApplicationStatus.REVIEW,
    ApplicationStatus.MATCHED,
    ApplicationStatus.NEEDS_ATTENTION,
    ApplicationStatus.ARCHIVED,
  ],
  REVIEW: [
    ApplicationStatus.INITIAL_SCREENING,
    ApplicationStatus.MATCHED,
    ApplicationStatus.TALENT_POOL,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  NEEDS_ATTENTION: [
    ApplicationStatus.PARSING,
    ApplicationStatus.REVIEW,
    ApplicationStatus.MATCHED,
    ApplicationStatus.TALENT_POOL,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  MATCHED: [
    ApplicationStatus.INITIAL_SCREENING,
    ApplicationStatus.REVIEW,
    ApplicationStatus.TALENT_POOL,
    ApplicationStatus.ARCHIVED,
  ],
  TALENT_POOL: [
    ApplicationStatus.INITIAL_SCREENING,
    ApplicationStatus.ARCHIVED,
  ],
  INITIAL_SCREENING: [
    ApplicationStatus.CLIENT_ENDORSEMENT,
    ApplicationStatus.TALENT_POOL,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  CLIENT_ENDORSEMENT: [
    ApplicationStatus.FINAL_INTERVIEW,
    ApplicationStatus.TALENT_POOL,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  FINAL_INTERVIEW: [
    ApplicationStatus.HIRED,
    ApplicationStatus.TALENT_POOL,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  HIRED: [
    ApplicationStatus.COMPLIANCE,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  ONBOARDING: [
    ApplicationStatus.COMPLIANCE,
    ApplicationStatus.DEPLOYED,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  COMPLIANCE: [
    ApplicationStatus.DEPLOYED,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  DEPLOYED: [
    ApplicationStatus.ARCHIVED,
  ],
  BACKOUT: [],
  ARCHIVED: [],
};

export const DeploymentStatus = {
  READY_FOR_DEPLOYMENT: "READY_FOR_DEPLOYMENT",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
  CANCELLED: "CANCELLED",
} as const;
export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

export const ALLOWED_DEPLOYMENT_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  [DeploymentStatus.READY_FOR_DEPLOYMENT]: [DeploymentStatus.ACTIVE, DeploymentStatus.CANCELLED],
  [DeploymentStatus.ACTIVE]: [DeploymentStatus.ENDED],
  [DeploymentStatus.ENDED]: [],
  [DeploymentStatus.CANCELLED]: [],
};

export const EmploymentStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SEPARATED: "SEPARATED",
  AVAILABLE_FOR_REDEPLOYMENT: "AVAILABLE_FOR_REDEPLOYMENT",
} as const;
export type EmploymentStatus = (typeof EmploymentStatus)[keyof typeof EmploymentStatus];

export const EmploymentEventType = {
  HIRED: "HIRED",
  DEPLOYED: "DEPLOYED",
  ASSIGNMENT_ENDED: "ASSIGNMENT_ENDED",
  REDEPLOYED: "REDEPLOYED",
  STATUS_CHANGE: "STATUS_CHANGE",
  SEPARATED: "SEPARATED",
} as const;
export type EmploymentEventType = (typeof EmploymentEventType)[keyof typeof EmploymentEventType];

export const InterviewType = {
  INITIAL_SCREENING: "INITIAL_SCREENING",
  FINAL_INTERVIEW: "FINAL_INTERVIEW",
} as const;
export type InterviewType = (typeof InterviewType)[keyof typeof InterviewType];

export const JobStatus = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const TalentPoolStatus = {
  ACTIVE: "ACTIVE",
  PLACED: "PLACED",
  INACTIVE: "INACTIVE",
} as const;
export type TalentPoolStatus = (typeof TalentPoolStatus)[keyof typeof TalentPoolStatus];

export const CandidateAvailability = {
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
  UNKNOWN: "UNKNOWN",
} as const;
export type CandidateAvailability = (typeof CandidateAvailability)[keyof typeof CandidateAvailability];

export const TalentPoolContactOutcome = {
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  NO_RESPONSE: "NO_RESPONSE",
  UNAVAILABLE: "UNAVAILABLE",
} as const;
export type TalentPoolContactOutcome = (typeof TalentPoolContactOutcome)[keyof typeof TalentPoolContactOutcome];

export const DocumentCategory = {
  RESUME: "RESUME",
  PHOTO: "PHOTO",
  ASSET: "ASSET",
  POST_HIRE: "POST_HIRE",
  VAULT_201: "VAULT_201",
} as const;
export type DocumentCategory = (typeof DocumentCategory)[keyof typeof DocumentCategory];

export const AssetVerificationState = {
  UNVERIFIED: "UNVERIFIED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;
export type AssetVerificationState = (typeof AssetVerificationState)[keyof typeof AssetVerificationState];

export const CandidateScoringDimension = {
  SKILLS: "SKILLS",
  EXPERIENCE: "EXPERIENCE",
  LOCATION: "LOCATION",
  COMPLIANCE: "COMPLIANCE",
  EDUCATION_CERTIFICATIONS: "EDUCATION_CERTIFICATIONS",
} as const;
export type CandidateScoringDimension = (typeof CandidateScoringDimension)[keyof typeof CandidateScoringDimension];

export const CandidateScoreStatus = {
  CALCULATED: "CALCULATED",
  STALE: "STALE",
  FAILED: "FAILED",
} as const;
export type CandidateScoreStatus = (typeof CandidateScoreStatus)[keyof typeof CandidateScoreStatus];
