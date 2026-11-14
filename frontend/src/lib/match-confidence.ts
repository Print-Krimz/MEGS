export type MatchConfidence = "High" | "Medium" | "Low";
const labels: Record<string, string> = { SKILLS: "Skills", EXPERIENCE: "Experience", LOCATION: "Location", COMPLIANCE: "Requirements", EDUCATION_CERTIFICATIONS: "Education / certificates" };
const unsure = new Set(["NOT_ASSESSED", "NEEDS_REVIEW", "JOB_UNCLEAR"]);
const known = new Set(["EVALUATED", "NOT_REQUIRED", "PENDING_ONBOARDING_STAGE", ...unsure]);
function object(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return null; } }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function confidenceDetails(explanation: unknown): { level: MatchConfidence | null; reasons: string[] } {
  const data = object(explanation);
  const statuses = object(data?.dimensionStatuses);
  if (!data || !statuses || typeof data.activeTotalWeight !== "number" || !Number.isFinite(data.activeTotalWeight) || typeof data.embeddingUsed !== "boolean" || Object.keys(labels).some(key => typeof statuses[key] !== "string" || !known.has(statuses[key] as string))) return { level: null, reasons: [] };
  const affected = Object.entries(labels).filter(([key]) => unsure.has(statuses[key] as string));
  const reasons = affected.map(([key, label]) => `${label}: ${statuses[key] === "NOT_ASSESSED" ? "information is missing" : statuses[key] === "NEEDS_REVIEW" ? "information needs review" : "job requirements are unclear"}.`);
  if (data.activeTotalWeight === 0) reasons.unshift("No specific job requirements were configured.");
  if (!data.embeddingUsed) reasons.push("A similarity comparison was unavailable.");
  const level = data.activeTotalWeight === 0 || affected.length >= 2 ? "Low" : affected.length === 1 || !data.embeddingUsed ? "Medium" : "High";
  if (!reasons.length) reasons.push("The available criteria were assessed and a similarity comparison was used.");
  return { level, reasons };
}
export function confidenceOf(explanation: unknown): MatchConfidence | null { return confidenceDetails(explanation).level; }
