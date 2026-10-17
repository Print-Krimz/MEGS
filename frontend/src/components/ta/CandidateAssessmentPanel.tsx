import React from "react";
import { AlertTriangle } from "lucide-react";
import { RequirementChecklist, parseRequirementChecks, type RequirementCheck } from "./RequirementChecklist";

export interface CandidateAssessment {
  summary: string;
  strengths: string[];
  gaps: string[];
  requirements: RequirementCheck[];
  /** Plain-language differences when the resume may belong to someone else. */
  identityDifferences: string[];
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

/** Reads the stored AI assessment (JSON from the resume worker, or legacy plain text). */
export const parseCandidateAssessment = (aiSummary: unknown): CandidateAssessment | null => {
  if (!aiSummary) return null;
  try {
    const parsed = typeof aiSummary === "string" ? JSON.parse(aiSummary) : aiSummary;
    if (parsed && typeof parsed === "object") {
      const identity = parsed.identityCheck;
      return {
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        strengths: stringList(parsed.strengths),
        gaps: stringList(parsed.gaps),
        requirements: parseRequirementChecks(parsed.requirements),
        identityDifferences: identity?.result === "MISMATCH" ? stringList(identity.differences) : [],
      };
    }
  } catch {
    // Plain text fallback
  }
  return { summary: String(aiSummary), strengths: [], gaps: [], requirements: [], identityDifferences: [] };
};

const NoteList: React.FC<{ title: string; items: string[]; dotClassName: string }> = ({ title, items, dotClassName }) =>
  items.length === 0 ? null : (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold text-slate-700">{title}</h5>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-800">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotClassName}`} aria-hidden="true" />
            <span className="leading-snug">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

/**
 * One read-only view of the AI resume assessment: identity warning, summary,
 * requirement checklist, then any strengths or concerns not covered by a requirement.
 */
export const CandidateAssessmentPanel: React.FC<{ assessment: CandidateAssessment }> = ({ assessment }) => {
  const hasChecklist = assessment.requirements.length > 0;
  const hasNotes = assessment.strengths.length > 0 || assessment.gaps.length > 0;

  return (
    <section id="eval-assessment" aria-labelledby="eval-assessment-title" className="border border-slate-300 bg-white rounded-md">
      <div className="px-4 py-3 border-b border-slate-300">
        <h4 id="eval-assessment-title" className="text-sm font-semibold text-slate-900">
          Candidate assessment
        </h4>
      </div>

      <div className="p-4 space-y-4">
        {assessment.identityDifferences.length > 0 && (
          <div className="flex gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">Resume may belong to someone else</p>
              <ul className="space-y-0.5">
                {assessment.identityDifferences.map((difference, i) => (
                  <li key={i}>{difference}</li>
                ))}
              </ul>
              <p>Check the resume with the candidate before relying on this assessment.</p>
            </div>
          </div>
        )}

        {assessment.summary && <p className="text-sm text-slate-900 leading-relaxed">{assessment.summary}</p>}

        {hasChecklist && (
          <div className="pt-3 border-t border-slate-200">
            <RequirementChecklist checks={assessment.requirements} />
          </div>
        )}

        {hasNotes && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
            <NoteList
              title={hasChecklist ? "Other strengths" : "Strengths"}
              items={assessment.strengths}
              dotClassName="bg-teal-600"
            />
            <NoteList
              title={hasChecklist ? "Other concerns" : "Concerns"}
              items={assessment.gaps}
              dotClassName="bg-amber-500"
            />
          </div>
        )}
      </div>
    </section>
  );
};
