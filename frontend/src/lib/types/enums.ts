// ─────────────────────────────────────────────
// MEGS CORE ENUMS & STATE MACHINES
// Mirrors backend Prisma schema enums & business rules
// ─────────────────────────────────────────────

export const Role = {
  APPLICANT: 'APPLICANT',
  TALENT_ACQUISITION: 'TALENT_ACQUISITION',
  ADMINISTRATOR: 'ADMINISTRATOR',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const JobStatus = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const ApplicationStatus = {
  SUBMITTED: 'SUBMITTED',
  PARSING: 'PARSING',
  REVIEW: 'REVIEW',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
  MATCHED: 'MATCHED',
  TALENT_POOL: 'TALENT_POOL',
  INITIAL_SCREENING: 'INITIAL_SCREENING',
  CLIENT_ENDORSEMENT: 'CLIENT_ENDORSEMENT',
  FINAL_INTERVIEW: 'FINAL_INTERVIEW',
  HIRED: 'HIRED',
  ONBOARDING: 'ONBOARDING',
  COMPLIANCE: 'COMPLIANCE',
  DEPLOYED: 'DEPLOYED',
  BACKOUT: 'BACKOUT',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export const InterviewType = {
  INITIAL_SCREENING: 'INITIAL_SCREENING',
  FINAL_INTERVIEW: 'FINAL_INTERVIEW',
} as const;
export type InterviewType = (typeof InterviewType)[keyof typeof InterviewType];

export const InterviewResult = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PENDING: 'PENDING',
  NO_SHOW: 'NO_SHOW',
} as const;
export type InterviewResult = (typeof InterviewResult)[keyof typeof InterviewResult];

export const ClientEndorsementOutcome = {
  PENDING: 'PENDING',
  ENDORSED: 'ENDORSED',
  DECLINED: 'DECLINED',
  DEFERRED: 'DEFERRED',
} as const;
export type ClientEndorsementOutcome = (typeof ClientEndorsementOutcome)[keyof typeof ClientEndorsementOutcome];

export const ComplianceReviewStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
export type ComplianceReviewStatus = (typeof ComplianceReviewStatus)[keyof typeof ComplianceReviewStatus];

export const DeploymentStatus = {
  PENDING_ORIENTATION: 'PENDING_ORIENTATION',
  READY: 'READY',
  DISPATCHED: 'DISPATCHED',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

export const EmploymentStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SEPARATED: 'SEPARATED',
  AVAILABLE_FOR_REDEPLOYMENT: 'AVAILABLE_FOR_REDEPLOYMENT',
} as const;
export type EmploymentStatus = (typeof EmploymentStatus)[keyof typeof EmploymentStatus];

export const EmploymentEventType = {
  HIRED: 'HIRED',
  DEPLOYED: 'DEPLOYED',
  ASSIGNMENT_ENDED: 'ASSIGNMENT_ENDED',
  REDEPLOYED: 'REDEPLOYED',
  STATUS_CHANGE: 'STATUS_CHANGE',
  SEPARATED: 'SEPARATED',
} as const;
export type EmploymentEventType = (typeof EmploymentEventType)[keyof typeof EmploymentEventType];

export const CandidateScoringDimension = {
  SKILLS: 'SKILLS',
  EXPERIENCE: 'EXPERIENCE',
  LOCATION: 'LOCATION',
  COMPLIANCE: 'COMPLIANCE',
  EDUCATION_CERTIFICATIONS: 'EDUCATION_CERTIFICATIONS',
} as const;
export type CandidateScoringDimension = (typeof CandidateScoringDimension)[keyof typeof CandidateScoringDimension];

export const CandidateScoringConfigurationScope = {
  GLOBAL: 'GLOBAL',
} as const;
export type CandidateScoringConfigurationScope = (typeof CandidateScoringConfigurationScope)[keyof typeof CandidateScoringConfigurationScope];

export const CandidateScoringConfigurationStatus = {
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type CandidateScoringConfigurationStatus = (typeof CandidateScoringConfigurationStatus)[keyof typeof CandidateScoringConfigurationStatus];

export const CandidateScoreStatus = {
  CALCULATED: 'CALCULATED',
  STALE: 'STALE',
  FAILED: 'FAILED',
} as const;
export type CandidateScoreStatus = (typeof CandidateScoreStatus)[keyof typeof CandidateScoreStatus];

export const ScoringRevalidationTaskStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type ScoringRevalidationTaskStatus = (typeof ScoringRevalidationTaskStatus)[keyof typeof ScoringRevalidationTaskStatus];

export const ScoringRevalidationTarget = {
  CONFIGURATION: 'CONFIGURATION',
  JOB_POSTING: 'JOB_POSTING',
  APPLICATION: 'APPLICATION',
  APPLICANT_PROFILE: 'APPLICANT_PROFILE',
} as const;
export type ScoringRevalidationTarget = (typeof ScoringRevalidationTarget)[keyof typeof ScoringRevalidationTarget];

export const AssetVerificationState = {
  UNVERIFIED: 'UNVERIFIED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
export type AssetVerificationState = (typeof AssetVerificationState)[keyof typeof AssetVerificationState];

export const TalentPoolStatus = {
  ACTIVE: 'ACTIVE',
  PLACED: 'PLACED',
  INACTIVE: 'INACTIVE',
} as const;
export type TalentPoolStatus = (typeof TalentPoolStatus)[keyof typeof TalentPoolStatus];

export const CandidateAvailability = {
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
} as const;
export type CandidateAvailability = (typeof CandidateAvailability)[keyof typeof CandidateAvailability];

export const TalentPoolContactOutcome = {
  INTERESTED: 'INTERESTED',
  NOT_INTERESTED: 'NOT_INTERESTED',
  NO_RESPONSE: 'NO_RESPONSE',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type TalentPoolContactOutcome = (typeof TalentPoolContactOutcome)[keyof typeof TalentPoolContactOutcome];

export const DocumentCategory = {
  RESUME: 'RESUME',
  PHOTO: 'PHOTO',
  ASSET: 'ASSET',
  POST_HIRE: 'POST_HIRE',
  VAULT_201: 'VAULT_201',
} as const;
export type DocumentCategory = (typeof DocumentCategory)[keyof typeof DocumentCategory];

// ─────────────────────────────────────────────
// PIPELINE TRANSITION RULES & STAGES
// ─────────────────────────────────────────────

export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  SUBMITTED: [
    ApplicationStatus.PARSING,
    ApplicationStatus.REVIEW,
    ApplicationStatus.NEEDS_ATTENTION,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  PARSING: [
    ApplicationStatus.REVIEW,
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
    ApplicationStatus.TALENT_POOL,
    ApplicationStatus.BACKOUT,
    ApplicationStatus.ARCHIVED,
  ],
  MATCHED: [
    ApplicationStatus.INITIAL_SCREENING,
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
    ApplicationStatus.ONBOARDING,
    ApplicationStatus.BACKOUT,
  ],
  ONBOARDING: [
    ApplicationStatus.COMPLIANCE,
    ApplicationStatus.DEPLOYED,
    ApplicationStatus.BACKOUT,
  ],
  COMPLIANCE: [
    ApplicationStatus.DEPLOYED,
    ApplicationStatus.BACKOUT,
  ],
  DEPLOYED: [
    ApplicationStatus.ARCHIVED,
  ],
  BACKOUT: [],
  ARCHIVED: [],
};

export const CANONICAL_PIPELINE_STAGES: { status: ApplicationStatus; label: string; description: string }[] = [
  { status: ApplicationStatus.SUBMITTED, label: 'Submitted', description: 'Application received' },
  { status: ApplicationStatus.REVIEW, label: 'Review', description: 'AI parsed & profile screening' },
  { status: ApplicationStatus.INITIAL_SCREENING, label: 'Screening', description: 'Initial HR interview' },
  { status: ApplicationStatus.CLIENT_ENDORSEMENT, label: 'Endorsement', description: 'Client review & profile endorsement' },
  { status: ApplicationStatus.FINAL_INTERVIEW, label: 'Final Interview', description: 'Client/Panel interview' },
  { status: ApplicationStatus.HIRED, label: 'Hired', description: 'Offer accepted & employee record created' },
  { status: ApplicationStatus.COMPLIANCE, label: 'Compliance', description: 'Mandatory pre-employment document verification' },
  { status: ApplicationStatus.DEPLOYED, label: 'Deployed', description: 'Active onsite deployment' },
];
