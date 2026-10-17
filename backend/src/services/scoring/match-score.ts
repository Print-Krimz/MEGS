import { SCORING_DIMENSIONS, ScoringDimension, ScoringWeights, JobFeatureInput, CandidateFeatureInput } from "./scoring.types.js";
import { DEFAULT_WEIGHTS } from "./scoring-configuration.service.js";
import { assessRequirementClarity, calculateFitDimensions, clampScore, requiredYearsFromText } from "./scoring.dimensions.js";

/**
 * Pure match-score helpers shared by application screening and Talent Pool ranking,
 * so both show the same score for the same candidate and job.
 */

type JobSource = { title: string; requirements: string; location?: string | null };
type MrfSource = {
  location?: string | null;
  requiredSkills?: string | null;
  requiredExperience?: string | null;
  requiredEducation?: string | null;
  requiredCertifications?: string | null;
  complianceRequirements?: string | null;
  complianceTemplates?: Array<{ documentLabel: string }>;
} | null | undefined;

const splitList = (value?: string | null) =>
  value ? value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean) : undefined;

export const buildJobFeatureInput = (job: JobSource, mrf: MrfSource, applicationStage: string | null): JobFeatureInput => ({
  title: job.title,
  requirements: job.requirements,
  location: job.location ?? mrf?.location ?? null,
  requiredSkills: splitList(mrf?.requiredSkills),
  requiredYearsExperience: mrf?.requiredExperience ? requiredYearsFromText(mrf.requiredExperience) : undefined,
  requiredEducation: splitList(mrf?.requiredEducation),
  requiredCertifications: splitList(mrf?.requiredCertifications),
  requiredComplianceDocuments: mrf?.complianceTemplates?.length
    ? mrf.complianceTemplates.map((template) => template.documentLabel)
    : splitList(mrf?.complianceRequirements),
  applicationStage,
});

/** Whether a job's skills and location can be scored; shown to TA on the job and request pages. */
export const jobRequirementClarity = (job: JobSource, mrf: MrfSource) =>
  assessRequirementClarity(buildJobFeatureInput(job, mrf, null));

/**
 * The one text embedded for a job, in screening and in Talent Pool search. The description is
 * left out: it is mostly company and benefits copy and dilutes the requirements.
 */
export const buildJobEmbeddingText = (job: JobSource, mrf: MrfSource) =>
  [
    job.title,
    job.requirements,
    mrf?.requiredSkills,
    mrf?.requiredExperience,
    mrf?.requiredEducation,
    mrf?.requiredCertifications,
  ].filter(Boolean).join(" ");

/** Rule-based dimensions plus weight re-normalisation over the dimensions that apply. */
export const computeMatchScore = (
  candidate: CandidateFeatureInput,
  job: JobFeatureInput,
  similarity: number | undefined,
  weights: Partial<ScoringWeights>,
) => {
  const calculation = calculateFitDimensions(candidate, job, similarity);
  const dimensions = calculation.scores;
  const weightOf = (dim: ScoringDimension) => {
    const raw = Number(weights[dim]);
    return Number.isFinite(raw) ? raw : (DEFAULT_WEIGHTS[dim] ?? 0);
  };

  // A dimension counts only when it applies and was actually evaluated.
  const applicableDimensions = SCORING_DIMENSIONS.filter(
    (dim) => calculation.dimensionsApplicable[dim] === true && calculation.dimensionStatuses[dim] === "EVALUATED",
  );
  const activeTotalWeight = applicableDimensions.reduce((sum, dim) => sum + weightOf(dim), 0);

  const normalizedWeights = {} as Record<ScoringDimension, number>;
  let finalFitScore: number;
  if (activeTotalWeight > 0) {
    let rawFitScore = 0;
    for (const dim of SCORING_DIMENSIONS) {
      if (!applicableDimensions.includes(dim)) {
        normalizedWeights[dim] = 0;
        continue;
      }
      const normalizedWeight = (weightOf(dim) / activeTotalWeight) * 100;
      normalizedWeights[dim] = clampScore(normalizedWeight);
      const dimScore = Number.isFinite(dimensions[dim]) ? dimensions[dim] : 0;
      rawFitScore += (dimScore * normalizedWeight) / 100;
    }
    finalFitScore = clampScore(rawFitScore);
  } else {
    for (const dim of SCORING_DIMENSIONS) normalizedWeights[dim] = 0;
    finalFitScore = 50;
  }

  return {
    finalFitScore,
    dimensions,
    dimensionStatuses: calculation.dimensionStatuses,
    dimensionsApplicable: calculation.dimensionsApplicable,
    explanations: calculation.explanations,
    missingMandatory: calculation.missingMandatory,
    requirementClarity: calculation.requirementClarity,
    normalizedWeights,
    activeTotalWeight,
    // Dimensions left out because the profile lacks data, and those TA should check by hand.
    incompleteFields: SCORING_DIMENSIONS.filter((dim) => calculation.dimensionStatuses[dim] === "NOT_ASSESSED"),
    needsReview: SCORING_DIMENSIONS.filter((dim) => calculation.dimensionStatuses[dim] === "NEEDS_REVIEW"),
  };
};
