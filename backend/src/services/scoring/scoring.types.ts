export const SCORING_DIMENSIONS = [
  "SKILLS",
  "EXPERIENCE",
  "LOCATION",
  "COMPLIANCE",
  "EDUCATION_CERTIFICATIONS",
] as const;

export type ScoringDimension = (typeof SCORING_DIMENSIONS)[number];

export type ScoringWeights = Record<ScoringDimension, number>;

/**
 * EVALUATED counts toward the match score. The others are left out of the weighting:
 * NOT_REQUIRED (job asks nothing), PENDING_ONBOARDING_STAGE (checked at Requirements),
 * NOT_ASSESSED (candidate profile lacks the data), NEEDS_REVIEW (evidence unclear; TA checks),
 * JOB_UNCLEAR (the job's own requirement can't be scored, e.g. traits listed as skills).
 */
export type DimensionStatus = "EVALUATED" | "NOT_REQUIRED" | "PENDING_ONBOARDING_STAGE" | "NOT_ASSESSED" | "NEEDS_REVIEW" | "JOB_UNCLEAR";

export type DimensionExplanation = {
  basis: string;
  missingMandatory: boolean;
  dimensionStatus: DimensionStatus;
  isApplicable: boolean;
  /** Job requirements (original wording) found in the profile. Explanation only. */
  matched?: string[];
  /** Job requirements (original wording) not found in the profile. Explanation only. */
  missing?: string[];
  requiredYears?: number | null;
  candidateYears?: number | null;
  /** The job place the candidate's location matched. */
  locationMatchedOn?: string | null;
};

/** Problems in how a job states its requirements; the affected dimension is left out of the score. */
export type RequirementClarity = {
  skillsAreTraits: boolean;
  locationNotAPlace: boolean;
};

export type DimensionResult = {
  dimension: ScoringDimension;
  score: number;
  dimensionStatus: DimensionStatus;
  isApplicable: boolean;
  explanation: DimensionExplanation;
};

export type KnnSettings = {
  defaultK: number;
  maximumK: number;
  minimumSimilarity: number;
  includeArchived: boolean;
  excludeRejected: boolean;
  excludeCurrentlyHired: boolean;
};

export type ScoringConfigurationInput = {
  weights: ScoringWeights;
  knnSettings?: Partial<KnnSettings>;
  matchThreshold?: number;
};

export type SparseVector = ReadonlyMap<string, number>;

/** Only non-sensitive, job-relevant source fields belong in a feature profile. */
export type CandidateFeatureInput = {
  skills: string[];
  roleExperience: string[];
  yearsExperience: number | null;
  city: string | null;
  province: string | null;
  preferredAreas: string[];
  education: string[];
  certifications: string[];
  complianceDocuments: string[];
};

export type JobFeatureInput = {
  title: string;
  requirements: string;
  location: string | null;
  requiredSkills?: string[];
  requiredYearsExperience?: number | null;
  requiredEducation?: string[];
  requiredCertifications?: string[];
  requiredComplianceDocuments?: string[];
  applicationStage?: string | null;
};

export type KnnCandidate = {
  applicationId: number;
  vector: SparseVector;
};

export type KnnResult = {
  applicationId: number;
  similarity: number;
  rank: number;
};
