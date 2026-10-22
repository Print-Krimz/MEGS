import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_WEIGHTS, normalizeScoringWeights, rebalanceScoringWeights, type ScoringDimension } from "../../lib/scoring-weights";

const dimensions = Object.keys(DEFAULT_SCORING_WEIGHTS) as ScoringDimension[];
const totalUnits = (weights: typeof DEFAULT_SCORING_WEIGHTS) => Object.values(weights).reduce((sum, value) => sum + Math.round(value * 100), 0);

describe("scoring priorities", () => {
  it("keeps the total at exactly 100% through repeated changes to every slider", () => {
    let weights = { ...DEFAULT_SCORING_WEIGHTS };
    for (const dimension of dimensions) {
      for (let value = 0; value <= 100; value++) {
        weights = rebalanceScoringWeights(weights, dimension, value);
        expect(weights[dimension]).toBe(value);
        expect(totalUnits(weights)).toBe(10000);
        expect(Object.values(weights).every((weight) => weight >= 0 && weight <= 100)).toBe(true);
      }
    }
  });

  it("redistributes the remainder proportionally", () => {
    expect(rebalanceScoringWeights(DEFAULT_SCORING_WEIGHTS, "SKILLS", 65)).toEqual({
      SKILLS: 65, EXPERIENCE: 12.5, LOCATION: 7.5, COMPLIANCE: 7.5, EDUCATION_CERTIFICATIONS: 7.5,
    });
  });

  it("can move away from a single priority at 100%", () => {
    const single = rebalanceScoringWeights(DEFAULT_SCORING_WEIGHTS, "SKILLS", 100);
    expect(rebalanceScoringWeights(single, "SKILLS", 0)).toEqual({
      SKILLS: 0, EXPERIENCE: 25, LOCATION: 25, COMPLIANCE: 25, EDUCATION_CERTIFICATIONS: 25,
    });
  });

  it("preserves supported decimals and handles invalid historical totals", () => {
    const decimal = { SKILLS: 33.33, EXPERIENCE: 33.33, LOCATION: 11.12, COMPLIANCE: 11.11, EDUCATION_CERTIFICATIONS: 11.11 };
    expect(normalizeScoringWeights(decimal)).toEqual(decimal);
    for (const dimension of dimensions) expect(totalUnits(rebalanceScoringWeights(decimal, dimension, 99))).toBe(10000);
    expect(totalUnits(normalizeScoringWeights({ SKILLS: 150 }))).toBe(10000);
    expect(totalUnits(normalizeScoringWeights(Object.fromEntries(dimensions.map((key) => [key, 0]))))).toBe(10000);
  });
});
