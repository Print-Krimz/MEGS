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

export interface AuditLog {
  id: number;
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    role: string;
  } | null;
}

export interface RevalidationStatusResponse {
  counts: {
    PENDING: number;
    PROCESSING: number;
    COMPLETED: number;
    FAILED: number;
  };
  failures: Array<{
    id: string;
    target: string;
    lastError: string;
    attempts: number;
  }>;
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
