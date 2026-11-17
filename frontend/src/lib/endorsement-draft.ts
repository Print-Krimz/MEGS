import { parseCandidateAssessment } from "../components/ta/CandidateAssessmentPanel";
import { FIELD_LIMITS } from "./field-limits";

export interface EndorsementDraftInput {
  fitScore?: number | null;
  skills?: string[] | null;
  aiSummary?: unknown;
  screeningNotes?: string | null;
}

export function buildClientEndorsementDraft(input: EndorsementDraftInput): string {
  const lines: string[] = [];

  if (typeof input.fitScore === "number" && Number.isFinite(input.fitScore)) {
    lines.push(`Fit score: ${Math.round(input.fitScore)}/100`);
  }

  const screening = input.screeningNotes?.trim();
  if (screening) {
    lines.push(`Screening notes: ${screening}`);
  }

  const topSkills = (input.skills ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (topSkills.length > 0) {
    lines.push(`Key skills: ${topSkills.join(", ")}`);
  }

  const assessment = parseCandidateAssessment(input.aiSummary);
  if (assessment) {
    if (assessment.strengths.length > 0) {
      lines.push(`Strengths: ${assessment.strengths.slice(0, 3).join("; ")}`);
    } else if (assessment.summary.trim()) {
      lines.push(`Summary: ${assessment.summary.trim()}`);
    }
  }

  const draft = lines.join("\n").trim();
  if (draft.length <= FIELD_LIMITS.notes) return draft;
  return `${draft.slice(0, FIELD_LIMITS.notes - 3).trimEnd()}...`;
}
