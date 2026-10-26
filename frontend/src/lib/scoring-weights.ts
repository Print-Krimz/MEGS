export const DEFAULT_SCORING_WEIGHTS = {
  SKILLS: 40,
  EXPERIENCE: 25,
  LOCATION: 15,
  COMPLIANCE: 10,
  EDUCATION_CERTIFICATIONS: 10,
};

export type ScoringDimension = keyof typeof DEFAULT_SCORING_WEIGHTS;
export type ScoringWeights = Record<ScoringDimension, number>;
const dimensions = Object.keys(DEFAULT_SCORING_WEIGHTS) as ScoringDimension[];

// Turn legacy decimal weights into whole numbers totalling 100 (largest remainder).
export function normalizeScoringWeights(input: Partial<ScoringWeights>): ScoringWeights {
  const raw = { ...DEFAULT_SCORING_WEIGHTS };
  for (const key of dimensions) {
    const value = input[key];
    if (value !== undefined) raw[key] = Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  const total = dimensions.reduce((sum, key) => sum + raw[key], 0);
  const shares = dimensions.map((key) => {
    const exact = total > 0 ? (raw[key] / total) * 100 : 100 / dimensions.length;
    return { key, whole: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remaining = 100 - shares.reduce((sum, share) => sum + share.whole, 0);
  [...shares].sort((a, b) => b.fraction - a.fraction).forEach((share) => {
    if (remaining > 0) { share.whole++; remaining--; }
  });
  const result = { ...raw };
  for (const share of shares) result[share.key] = share.whole;
  return result;
}

// Change one metric only; the others stay as they are.
export function setScoringWeight(weights: ScoringWeights, dimension: ScoringDimension, value: number): ScoringWeights {
  if (!Number.isFinite(value)) return weights;
  return { ...weights, [dimension]: Math.round(Math.max(0, Math.min(100, value))) };
}

const totalWeight = (weights: ScoringWeights) => dimensions.reduce((sum, key) => sum + weights[key], 0);

export function remainingWeight(weights: ScoringWeights): number {
  return 100 - totalWeight(weights);
}

// Highest value this metric can take without pushing the total past 100.
// Never below its current value, so an over-allocated metric can still be lowered.
export function maxFor(weights: ScoringWeights, dimension: ScoringDimension): number {
  const others = totalWeight(weights) - weights[dimension];
  return Math.max(weights[dimension], 100 - others);
}
