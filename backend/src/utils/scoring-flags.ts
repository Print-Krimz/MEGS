const enabled = (value: string | undefined) => value === "true";

export const scoringFlags = {
  dynamicCandidateScoringEnabled: () => enabled(process.env.DYNAMIC_CANDIDATE_SCORING_ENABLED),
  knnTalentPoolingEnabled: () => enabled(process.env.KNN_TALENT_POOLING_ENABLED),
  candidateScoreRevalidationEnabled: () => enabled(process.env.CANDIDATE_SCORE_REVALIDATION_ENABLED),
};
