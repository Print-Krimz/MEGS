export type MatchConfidence = "High" | "Medium" | "Low";

const UNSURE = new Set(["NOT_ASSESSED", "NEEDS_REVIEW", "JOB_UNCLEAR"]);

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
};

/**
 * How sure the AI match is, from data already stored with the score.
 * Older scores may lack activeTotalWeight / embeddingUsed: absent means unknown, not zero or false.
 */
export function confidenceOf(explanation: unknown): MatchConfidence | null {
  const data = asObject(explanation);
  if (!data) return null;

  const statuses = asObject(data.dimensionStatuses) ?? {};
  const unsure = Object.values(statuses).filter((s) => typeof s === "string" && UNSURE.has(s)).length;

  if (data.activeTotalWeight === 0 || unsure >= 2) return "Low";
  if (unsure === 1 || data.embeddingUsed === false) return "Medium";
  return "High";
}
