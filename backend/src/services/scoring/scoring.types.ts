export const SCORING_DIMENSIONS = [
  "SKILLS",
  "EXPERIENCE",
  "LOCATION",
  "COMPLIANCE",
  "EDUCATION_CERTIFICATIONS",
] as const;

export type ScoringDimension = (typeof SCORING_DIMENSIONS)[number];

export type ScoringWeights = Record<ScoringDimension, number>;

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
