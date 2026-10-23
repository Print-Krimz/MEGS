export const DEFAULT_SCORING_WEIGHTS = {
  SKILLS: 30,
  EXPERIENCE: 25,
  LOCATION: 15,
  COMPLIANCE: 15,
  EDUCATION_CERTIFICATIONS: 15,
};

export type ScoringDimension = keyof typeof DEFAULT_SCORING_WEIGHTS;
export type ScoringWeights = Record<ScoringDimension, number>;
const dimensions = Object.keys(DEFAULT_SCORING_WEIGHTS) as ScoringDimension[];

// Allocate hundredths of a percent with largest remainders, so rounding never
// adds or loses percentage points. Zeroed priorities share the remainder evenly.
function allocate(weights: ScoringWeights, keys: ScoringDimension[], units: number): ScoringWeights {
  const total = keys.reduce((sum, key) => sum + weights[key], 0);
  const shares = keys.map((key) => {
    const exact = total > 0 ? weights[key] / total * units : units / keys.length;
    return { key, units: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remaining = units - shares.reduce((sum, share) => sum + share.units, 0);
  shares.sort((a, b) => b.fraction - a.fraction);
  for (const share of shares) {
    if (remaining > 0) { share.units++; remaining--; }
  }
  const result = { ...weights };
  for (const share of shares) result[share.key] = share.units / 100;
  return result;
}

export function normalizeScoringWeights(input: Partial<ScoringWeights>): ScoringWeights {
  const weights = { ...DEFAULT_SCORING_WEIGHTS };
  for (const key of dimensions) {
    const value = input[key];
    if (value !== undefined) weights[key] = Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  return allocate(weights, dimensions, 10000);
}

export function rebalanceScoringWeights(weights: ScoringWeights, changed: ScoringDimension, value: number): ScoringWeights {
  if (!Number.isFinite(value)) return weights;
  const units = Math.round(Math.max(0, Math.min(100, value)) * 100);
  const result = allocate(weights, dimensions.filter((key) => key !== changed), 10000 - units);
  result[changed] = units / 100;
  return result;
}
