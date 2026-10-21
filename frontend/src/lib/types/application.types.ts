import type { ApplicationBackoutRecord, ApplicationClosureRecord } from "../backout";
import type {
  ApplicationStatus,
  InterviewType,
  JobStatus,
} from "./enums";
import type { ApplicantProfile } from "./applicant.types";
import type { User } from "./auth.types";
import type { Deployment } from "./employee.types";

export interface JobPosting {
  id: number;
  postedById: string;
  title: string;
  description: string;
  requirements: string;
  location?: string | null;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: JobStatus;
  mrfId?: number | null;
  mrf?: {
    id: number;
    title: string;
    clientId: number;
    salaryRangeMin?: number | null;
    salaryRangeMax?: number | null;
    employmentType?: string | null;
    workArrangement?: string | null;
    client?: {
      id: number;
      name: string;
      industry?: string | null;
      contactName?: string | null;
      contactEmail?: string | null;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  postedBy?: User;
  alreadyApplied?: boolean;
  _count?: {
    applications: number;
  };
}

export interface Interview {
  id: number;
  applicationId: number;
  type: InterviewType;
  scheduledAt?: string | null;
  conductedAt?: string | null;
  result?: string | null;
  notes?: string | null;
  complianceDeadline?: string | null;
  isCompliant?: boolean | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientEndorsement {
  id: number;
  applicationId: number;
  clientId: number;
  outcome: "PENDING" | "APPROVED" | "DECLINED" | "ENDORSED";
  endorsedById?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: number;
    name: string;
  };
}

export interface ComplianceRequirement {
  id: number;
  applicationId: number;
  documentLabel: string;
  isRequired: boolean;
  deadline?: string | null;
  documentId?: number | null;
  reviewStatus: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" | "EXPIRED" | "TO_FOLLOW";
  toFollowExpectedAt?: string | null;
  reviewedById?: string | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  expiresAt?: string | null;
  issuedAt?: string | null;
  validityStatus?: "UNKNOWN" | "HAS_EXPIRY" | "NO_EXPIRY";
  updateRequestedAt?: string | null;
  updateRequestReason?: string | null;
  updateRequestDeadline?: string | null;
  updateRequestCompletedAt?: string | null;
  documentVersions?: Array<{
    id: number;
    documentId: number;
    issuedAt?: string | null;
    expiresAt?: string | null;
    validityStatus: "UNKNOWN" | "HAS_EXPIRY" | "NO_EXPIRY";
    reviewStatus: string;
    uploadedAt: string;
    isCurrent: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: {
    id: string;
    email: string;
  } | null;
}

export interface RecruiterDecision {
  id: number;
  applicationId: number;
  actorId: string;
  fromStatus: string;
  toStatus: string;
  reason?: string | null;
  transitionType?: "NORMAL" | "SKIP" | "FAST_TRACK";
  skippedStages?: string[];
  createdAt: string;
  actor?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface PostHireDocument {
  id: number;
  applicationId: number;
  label: string;
  fileUrl: string;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateScore {
  id: number;
  applicationId: number;
  jobPostingId: number;
  configurationId: number;
  status: string;
  skillsScore: number | string;
  experienceScore: number | string;
  locationScore: number | string;
  complianceScore: number | string;
  educationCertificationScore: number | string;
  finalFitScore: number | string;
  knnSimilarity?: number | string | null;
  explanation?: Record<string, unknown> | null;
  calculatedAt: string;
  candidate?: {
    id?: string;
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
    city?: string | null;
    province?: string | null;
    applicationStatus?: string;
  } | null;
}

export interface Application {
  id: number;
  userId: string;
  jobPostingId: number;
  status: ApplicationStatus;
  resumeUrl?: string | null;
  aiScore?: number | null;
  aiSummary?: string | null;
  candidateFitScore?: number | null;
  candidateFitScoreCalculatedAt?: string | null;
  contractSigned?: boolean;
  contractSignedAt?: string | null;
  contractNotes?: string | null;
  contractStartDate?: string | null;
  contractSignedById?: string | null;
  contractDocumentId?: number | null;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    applicantProfile?: ApplicantProfile | null;
    employee?: {
      id: number;
      employeeNumber: string;
      status: string;
      deployments?: Deployment[];
    } | null;
  };
  isRedeploymentEligible?: boolean;
  jobPosting?: JobPosting;
  interviews?: Interview[];
  clientEndorsements?: ClientEndorsement[];
  complianceRequirements?: ComplianceRequirement[];
  candidateScores?: CandidateScore[];
  postHireDocuments?: PostHireDocument[];
  recruiterDecisions?: RecruiterDecision[];
  deployments?: Deployment[];
  backout?: ApplicationBackoutRecord | null;
  /** The live closure (Rejected or Backed Out), if the application was closed. */
  closures?: ApplicationClosureRecord[];
  hiredEmployee?: {
    id: number;
    employeeNumber: string;
    status: string;
    department?: string | null;
    position?: string | null;
    hireDate?: string | null;
  } | null;
}

export interface ApplicantApplicationSummary {
  id: number;
  jobPostingId: number;
  status: ApplicationStatus;
  isArchived: boolean;
  createdAt: string;
  resumeAnalysisPending: boolean;
  jobPosting?: {
    id: number;
    title: string;
    location?: string | null;
  } | null;
}

export interface ReturningWorkerInfo {
  sameClient: boolean;
  clientName: string;
  priorPlacements: number;
}

export interface TAApplicationSummary {
  id: number;
  status: ApplicationStatus;
  isArchived: boolean;
  returning?: ReturningWorkerInfo | null;
  createdAt: string;
  aiScore?: number | null;
  candidateFitScore?: number | null;
  candidateFitScoreCalculatedAt?: string | null;
  candidateScoringConfigurationVersion?: number | null;
  /** When the application entered its current stage (ISO). */
  stageEnteredAt?: string;
  /** Whole days spent in the current stage. */
  daysInStage?: number;
  interviewCount: number;
  recruiterDecisionCount: number;
  user?: {
    id: string;
    email: string;
    applicantProfile?: {
      firstName?: string | null;
      lastName?: string | null;
      mobileNumber?: string | null;
    } | null;
  } | null;
  jobPosting?: {
    id: number;
    title: string;
    location?: string | null;
    mrf?: {
      id: number;
      title: string;
      clientId: number;
      client?: { id: number; name: string } | null;
    } | null;
  } | null;
}
