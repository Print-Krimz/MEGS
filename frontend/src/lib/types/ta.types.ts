import type {
  CandidateAvailability,
  DeploymentStatus,
  InterviewType,
  JobStatus,
  TalentPoolContactOutcome,
  TalentPoolStatus,
} from "./enums";
import type { ApplicantProfile } from "./applicant.types";
import type { Client } from "./client.types";
import type { JobPosting } from "./application.types";
import type { User } from "./auth.types";

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
  requiredSkills?: string | null;
  requiredExperience?: string | null;
  requiredEducation?: string | null;
  requiredCertifications?: string | null;
  salaryRangeMin?: number | null;
  salaryRangeMax?: number | null;
  employmentType?: string | null;
  workArrangement?: string | null;
  complianceRequirements?: string | null;
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
}

export interface UpdateMRFDto extends Partial<CreateMRFDto> {
  status?: "OPEN" | "IN_PROGRESS" | "FILLED" | "CANCELLED" | "ON_HOLD";
}

export interface CreateJobDto {
  title: string;
  description: string;
  requirements: string;
  location?: string;
  status?: JobStatus;
}

export interface UpdateJobDto {
  title?: string;
  description?: string;
  requirements?: string;
  location?: string;
  status?: JobStatus;
}

export interface ScheduleInterviewDto {
  type: InterviewType;
  scheduledAt: string;
  notes?: string;
}

export interface UpdateInterviewResultDto {
  result: "PASS" | "PASSED" | "FAIL" | "FAILED" | "NO_SHOW" | "PENDING";
  conductedAt?: string | null;
  notes?: string;
}

export interface EndorseCandidateDto {
  clientId: number;
  outcome: "PENDING" | "ENDORSED" | "DECLINED";
  notes?: string;
}

export interface AddComplianceRequirementDto {
  documentLabel: string;
  isRequired?: boolean;
  deadline?: string;
}

export interface ReviewComplianceDto {
  reviewStatus: "APPROVED" | "REJECTED" | "PENDING";
  reviewNotes?: string;
}

export interface DeployCandidateDto {
  clientId: number;
  mrfId?: number;
  site?: string;
  contractStart?: string;
  contractEnd?: string;
  notes?: string;
}

export interface UpdateDeploymentStatusDto {
  status: DeploymentStatus;
  notes?: string;
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

export interface TalentPoolMatchResult {
  candidate: ApplicantProfile & {
    user?: { email: string };
    membershipId?: number;
  };
  similarity: number;
  knnRank: number;
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
  totalApplications: number;
  archivedApplications: number;
  statusBreakdown: Record<string, number>;
}

export interface TimeToFillAnalytics {
  averageDaysToFill: number;
  totalFilledDeployments: number;
  details?: Array<{
    mrfId: number;
    title: string;
    clientName: string;
    daysToFill: number;
  }>;
}

export interface DeploymentAnalytics {
  totalDeployments: number;
  statusBreakdown: Record<string, number>;
}

export interface ComplianceAnalytics {
  totalRequirements: number;
  statusBreakdown: Record<string, number>;
}

export interface InterviewSLASummary {
  summary: {
    total: number;
    breached: number;
    warning: number;
    healthy: number;
  };
  details: Array<{
    interviewId: number;
    applicationId: number;
    candidateName: string;
    jobTitle: string;
    scheduledAt: string;
    deadline: string;
    status: "HEALTHY" | "WARNING" | "BREACHED";
  }>;
}
