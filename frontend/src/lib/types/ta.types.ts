import type {
  CandidateAvailability,
  DeploymentStatus,
  InterviewType,
  JobStatus,
  TalentPoolContactOutcome,
  TalentPoolInvitationStatus,
  TalentPoolStatus,
} from "./enums";
import type { ApplicantProfile } from "./applicant.types";
import type { Client } from "./client.types";
import type { JobPosting } from "./application.types";
import type { PaginatedListResponse } from "./api.types";
import type { User } from "./auth.types";

declare module "./application.types" {
  interface JobPosting {
    isEvergreen?: boolean;
    /** Set on the job detail response: requirements the match score can't use as written. */
    requirementClarity?: RequirementClarity;
  }
}

/** Problems in how a job or request states its requirements (from the backend). */
export interface RequirementClarity {
  skillsAreTraits: boolean;
  locationNotAPlace: boolean;
}

/** Status of one match score dimension. Only EVALUATED counts toward the score. */
export type DimensionStatus =
  | "EVALUATED"
  | "NOT_REQUIRED"
  | "PENDING_ONBOARDING_STAGE"
  | "NOT_ASSESSED"
  | "NEEDS_REVIEW"
  | "JOB_UNCLEAR";

/** Per-dimension detail stored with a match score (fit-score-v3 and later). */
export interface DimensionExplanation {
  basis?: string;
  matched?: string[];
  missing?: string[];
  requiredYears?: number | null;
  candidateYears?: number | null;
  locationMatchedOn?: string | null;
}

export type { JobPosting, ComplianceRequirement } from "./application.types";

export type ResumeAnalysisPhase =
  | "IDLE"
  | "QUEUED"
  | "READING_RESUME"
  | "EXTRACTING_TEXT"
  | "AI_ANALYSIS"
  | "SCORING"
  | "DONE"
  | "FAILED";

export interface ResumeAnalysisStatus {
  phase: ResumeAnalysisPhase;
  startedAt?: string;
  updatedAt?: string;
  /** Gemini resume review score. */
  score?: number;
  /** Rule-based match score, the one shown on the application page. */
  fitScore?: number | null;
  requirementsMet?: number;
  requirementsTotal?: number;
  /** Why a FAILED run stopped. */
  failureReason?: "NOT_FOUND" | "NO_RESUME" | "UNREADABLE_RESUME" | "AI_UNAVAILABLE" | "SAVE_FAILED";
}

export interface MRFComplianceTemplate {
  id: number;
  mrfId?: number | null;
  clientId?: number | null;
  documentLabel: string;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManpowerRequest {
  id: number;
  clientId: number;
  title: string;
  description?: string | null;
  headcount: number;
  location?: string | null;
  targetFillDate?: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  /** Set on the request detail response. */
  requirementClarity?: RequirementClarity;
  requiredSkills?: string | null;
  requiredExperience?: string | null;
  requiredEducation?: string | null;
  requiredCertifications?: string | null;
  salaryRangeMin?: number | null;
  salaryRangeMax?: number | null;
  employmentType?: string | null;
  workArrangement?: string | null;
  complianceRequirements?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  genderPreference?: string | null;
  tattooPolicy?: string | null;
  /** false = no client review step for this request. Existing requests are true. */
  requiresClientReview?: boolean;
  status: "OPEN" | "IN_PROGRESS" | "FILLED" | "CANCELLED" | "ON_HOLD";
  createdById: string;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  createdBy?: User;
  jobPostings?: JobPosting[];
  complianceTemplates?: MRFComplianceTemplate[];
  deployments?: unknown[];
  _count?: {
    jobPostings: number;
    deployments: number;
  };
  fulfillment?: {
    mrfId: number;
    headcount: number;
    deployedCount: number;
    remainingCount: number;
    fulfillmentRate: number;
    isFulfilled: boolean;
  };
}

export interface CreateMRFDto {
  clientId: number;
  title: string;
  description?: string;
  headcount?: number;
  location?: string;
  targetFillDate?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  requiredSkills?: string;
  requiredExperience?: string;
  requiredEducation?: string;
  requiredCertifications?: string;
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  employmentType?: string;
  workArrangement?: string;
  complianceRequirements?: string;
  ageMin?: number | null;
  ageMax?: number | null;
  genderPreference?: string | null;
  tattooPolicy?: string | null;
  requiresClientReview?: boolean;
}

export interface UpdateMRFDto extends Partial<CreateMRFDto> {
  ageMin?: number | null;
  ageMax?: number | null;
  genderPreference?: string | null;
  tattooPolicy?: string | null;
  status?: "OPEN" | "IN_PROGRESS" | "FILLED" | "CANCELLED" | "ON_HOLD";
}

export interface CreateJobDto {
  title: string;
  description: string;
  requirements: string;
  location?: string;
  imageUrl?: string;
  mrfId?: number;
  status?: JobStatus;
  isEvergreen?: boolean;
}

export interface UpdateJobDto {
  title?: string;
  description?: string;
  requirements?: string;
  location?: string;
  imageUrl?: string;
  mrfId?: number;
  status?: JobStatus;
  isEvergreen?: boolean;
}

export interface ScheduleInterviewDto {
  type: InterviewType;
  scheduledAt: string;
  /** Meeting place or link. */
  location?: string;
  notes?: string;
}

export interface ScheduleContractSigningDto {
  scheduledAt: string;
  location: string;
}

export interface ApproveRescheduleDto {
  scheduledAt: string;
  location?: string;
}

export interface UpdateInterviewResultDto {
  result: "PASS" | "PASSED" | "FAIL" | "FAILED" | "NO_SHOW" | "PENDING";
  conductedAt?: string | null;
  notes?: string;
}

export interface EndorseCandidateDto {
  clientId?: number;
  outcome?: "PENDING" | "APPROVED" | "DECLINED" | "ENDORSED";
  notes?: string;
}

export interface AddComplianceRequirementDto {
  documentLabel: string;
  isRequired?: boolean;
  deadline?: string;
}

export interface ReviewComplianceDto {
  reviewStatus: "APPROVED" | "REJECTED" | "PENDING" | "EXPIRED" | "TO_FOLLOW";
  reviewNotes?: string;
  expiresAt?: string | null;
  issuedAt?: string | null;
  validityStatus?: "UNKNOWN" | "HAS_EXPIRY" | "NO_EXPIRY";
  toFollowExpectedAt?: string | null;
}

export interface DeployCandidateDto {
  clientId: number;
  mrfId?: number;
  site?: string;
  contractStart?: string;
  contractEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  notes?: string;
}

export interface UpdateDeploymentStatusDto {
  status: DeploymentStatus;
  notes?: string;
  actualStart?: string;
}

export interface TalentPoolMembership {
  id: number;
  applicantProfileId: number;
  sourceApplicationId?: number | null;
  status: TalentPoolStatus;
  availability: CandidateAvailability;
  addedById: string;
  addedAt: string;
  updatedAt: string;
  lastContactedAt?: string | null;
  notes?: string | null;
  applicantProfile?: ApplicantProfile;
  contacts?: TalentPoolContact[];
}

export interface TalentPoolContact {
  id: number;
  membershipId: number;
  jobPostingId: number;
  recruiterId: string;
  outcome: TalentPoolContactOutcome;
  notes?: string | null;
  contactedAt: string;
}

export interface TalentPoolSearchDto {
  jobId?: number;
  candidateId?: number;
  text?: string;
  k?: number;
}

export interface TalentPoolCandidate {
  id: string; // User ID
  applicantProfileId: number;
  membershipId?: number;
  email: string;
  firstName: string;
  lastName: string;
  city?: string | null;
  province?: string | null;
  barangay?: string | null;
  postalCode?: string | null;
  currentRole?: string | null;
  skills: string[];
  availability: CandidateAvailability;
  talentPoolStatus: TalentPoolStatus;
  lastContactedAt?: string | null;
}

/** Talent pool search response. unsearchableCount = eligible members without a search index yet. */
export interface TalentPoolSearchResult {
  items: TalentPoolMatchResult[];
  unsearchableCount: number;
  /** Job searches only. */
  requirementClarity?: RequirementClarity;
}

/** An open application on another job; shown as a tag, TA decides. */
export interface InProcessApplication {
  applicationId: number;
  jobId: number;
  jobTitle: string;
  status: string;
}

export interface TalentPoolMatchResult {
  candidate: TalentPoolCandidate;
  /** Profile similarity (0-1). Used to build the shortlist; not a grade. */
  similarity: number;
  knnRank: number;
  /** Job searches only: the same match score screening shows (0-100). */
  matchScore?: number | null;
  dimensionStatuses?: Record<string, DimensionStatus> | null;
  /** Job searches only: required skills or credentials not found in the profile. */
  missingRequired?: string[];
  inProcessFor?: InProcessApplication[];
}

export interface ConsiderCandidateForJobDto {
  applicantProfileId: number;
  targetJobId: number;
  notes?: string;
  contactOutcome?: TalentPoolContactOutcome;
}

export interface ConsiderForJobResult {
  success: boolean;
  message: string;
  application: any;
  contact: TalentPoolContact;
  score?: any;
}

export interface TalentPoolInvitationRecord {
  id: number;
  membershipId: number;
  jobPostingId: number;
  jobPostingTitle: string;
  jobPostingLocation?: string | null;
  jobPostingStatus: JobStatus;
  candidateId: string;
  applicantProfileId: number;
  candidateName: string;
  candidateEmail: string;
  status: TalentPoolInvitationStatus;
  message?: string | null;
  declineReason?: string | null;
  responseNotes?: string | null;
  expiresAt?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  invitedBy?: string;
  /** False for walk-in applicants who never claimed an account. */
  hasPortalAccess?: boolean;
  hasMobile?: boolean;
  /** Masked mobile number for the text-link confirm, for example 0917****521. */
  maskedMobile?: string | null;
  responseChannel?: "PORTAL" | "ASSISTED_PHONE" | "IN_PERSON" | "MAGIC_LINK" | null;
}

export interface SendTalentPoolInvitationDto {
  applicantProfileId: number;
  targetJobId: number;
  message?: string;
  expiresInDays?: number;
}

export interface BatchSendTalentPoolInvitationsDto {
  applicantProfileIds: number[];
  targetJobId: number;
  message?: string;
  expiresInDays?: number;
}

export interface UpdateCandidateProfileDto {
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
  mobileNumber?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  city?: string | null;
  province?: string | null;
  barangay?: string | null;
  postalCode?: string | null;
  tattooStatus?: "NONE" | "NON_VISIBLE" | "VISIBLE" | string | null;
  sss?: string | null;
  philhealth?: string | null;
  pagibig?: string | null;
  tin?: string | null;
  address?: string | null;
}

export interface HireCandidateDto {
  employeeNumber?: string;
  department?: string;
  position?: string;
  startDate?: string;
  notes?: string;
  reason?: string;
}

export interface PipelineAnalytics {
  activeApplications: number;
  statusBreakdown: Record<string, number>;
}

export interface ComplianceAnalytics {
  totalRequirements: number;
  statusBreakdown: Record<string, number>;
}

export interface InterviewSLAItem {
  /** The open interview for the stage; null when none is scheduled yet. */
  interviewId: number | null;
  applicationId: number;
  candidateName: string;
  jobTitle: string;
  scheduledAt: string;
  deadline: string;
  status: "HEALTHY" | "WARNING" | "BREACHED";
  currentStage?: string;
}

export interface InterviewSLASummary {
  summary: {
    total: number;
    breached: number;
    warning: number;
    healthy: number;
  };
  details: InterviewSLAItem[];
}

/** Paginated interview SLA report: one page of items plus the unfiltered summary and position choices. */
export interface InterviewSLAPage extends PaginatedListResponse<InterviewSLAItem> {
  summary: InterviewSLASummary["summary"];
  positions: string[];
}
