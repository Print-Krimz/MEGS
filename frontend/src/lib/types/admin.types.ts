import type { CandidateScoringDimension } from "./enums";
import type { User } from "./auth.types";

export interface CandidateScoringWeight {
  id: number;
  configurationId: number;
  dimension: CandidateScoringDimension;
  weight: number;
}

export interface CandidateScoringKnnSettings {
  defaultK?: number;
  maximumK?: number;
  minimumSimilarity?: number;
  includeArchived?: boolean;
  excludeRejected?: boolean;
  excludeCurrentlyHired?: boolean;
}

export interface CandidateScoringConfiguration {
  id: number;
  scope: string;
  status: "ACTIVE" | "SUPERSEDED";
  version: number;
  revision: number;
  knnSettings?: CandidateScoringKnnSettings | null;
  matchThreshold?: number;
  createdById?: string | null;
  activatedById?: string | null;
  activatedAt: string;
  supersededAt?: string | null;
  createdAt: string;
  weights: Record<CandidateScoringDimension, number> | CandidateScoringWeight[];
  createdBy?: User | null;
  activatedBy?: User | null;
}

export interface UpdateScoringConfigDto {
  expectedRevision: number;
  weights: {
    SKILLS: number;
    EXPERIENCE: number;
    LOCATION: number;
    COMPLIANCE: number;
    EDUCATION_CERTIFICATIONS: number;
  };
  knnSettings?: CandidateScoringKnnSettings;
  matchThreshold?: number;
}

export type AuditCategory =
  | "Authentication"
  | "User Management"
  | "Recruitment"
  | "Talent Pool"
  | "Configuration"
  | "Compliance"
  | "Deployment"
  | "Security";

export interface AuditLog {
  id: number;
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | number | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    role: string;
    applicantProfile?: {
      firstName?: string;
      lastName?: string;
    } | null;
  } | null;
}

export interface AuditLogQueryFilters {
  action?: string;
  userId?: string;
  entity?: string;
  category?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export type BackupStatus = "IN_PROGRESS" | "SUCCESS" | "FAILED";
export type BackupType = "MANUAL" | "SCHEDULED_ROUTINE";

export interface DatabaseBackupRecord {
  id: string;
  filename: string;
  sizeBytes: number | null;
  checksumSha256: string | null;
  status: BackupStatus;
  backupType: BackupType;
  encryptionMethod: string;
  tablesIncluded: string[];
  errorMessage: string | null;
  durationMs: number | null;
  initiatedBy: { id: string; email: string } | null;
  createdAt: string;
  completedAt: string | null;
}

export interface QualityMetricsResponse {
  totalCalculated: number;
  averageFitScore: number;
  minFitScore: number;
  maxFitScore: number;
  scoreDistribution: Record<string, number>;
  knnLatencyP95?: number;
  coveragePercentage: number;
}
