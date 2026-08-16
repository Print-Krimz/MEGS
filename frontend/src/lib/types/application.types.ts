import type {
  ApplicationStatus,
  InterviewType,
  JobStatus,
} from "./enums";
import type { ApplicantProfile } from "./applicant.types";
import type { User } from "./auth.types";

export interface JobPosting {
  id: number;
  postedById: string;
  title: string;
  description: string;
  requirements: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: JobStatus;
  mrfId?: number | null;
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
  outcome: "PENDING" | "ENDORSED" | "DECLINED";
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
  reviewStatus: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
  reviewedById?: string | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  expiresAt?: string | null;
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
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    applicantProfile?: ApplicantProfile | null;
  };
  jobPosting?: JobPosting;
  interviews?: Interview[];
  clientEndorsements?: ClientEndorsement[];
  complianceRequirements?: ComplianceRequirement[];
  candidateScores?: CandidateScore[];
  postHireDocuments?: PostHireDocument[];
  recruiterDecisions?: RecruiterDecision[];
  hiredEmployee?: {
    id: number;
    employeeNumber: string;
    status: string;
    department?: string | null;
    position?: string | null;
    hireDate?: string | null;
  } | null;
}
