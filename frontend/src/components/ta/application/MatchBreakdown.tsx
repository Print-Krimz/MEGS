import React from "react";
import { ScoreBadge } from "../../common";
import { CandidateAssessmentPanel, type CandidateAssessment } from "../CandidateAssessmentPanel";
import { ScoreReasons } from "../ScoreReasons";
import type { DimensionExplanation } from "../../../lib/types/ta.types";

export interface ScoreExplanation {
  dimensionStatuses?: Record<string, string>;
  dimensionsApplicable?: Record<string, boolean>;
  dimensionExplanations?: Record<string, DimensionExplanation>;
  missingMandatory?: string[];
  [key: string]: unknown;
}

export interface MatchBreakdownProps {
  scores?: {
    skillsScore?: number | string | null;
    experienceScore?: number | string | null;
    locationScore?: number | string | null;
    complianceScore?: number | string | null;
    educationCertificationScore?: number | string | null;
  } | null;
  explanation: ScoreExplanation | null;
  assessment: CandidateAssessment | null;
  fitScore?: number | string | null;
  /**
   * Requirement progress once the application reached the requirements stage.
   * Null before that: the score then says "Pending onboarding".
   */
  requirementsResult: { approved: number; total: number } | null;
}

const DIMENSIONS = [
  { key: "SKILLS", label: "Skills match", scoreKey: "skillsScore" },
  { key: "EXPERIENCE", label: "Experience fit", scoreKey: "experienceScore" },
  { key: "LOCATION", label: "Location proximity", scoreKey: "locationScore" },
  { key: "COMPLIANCE", label: "Requirements match", scoreKey: "complianceScore" },
  { key: "EDUCATION_CERTIFICATIONS", label: "Education / certs", scoreKey: "educationCertificationScore" },
] as const;

/** The score once, with the reasons behind it and the assessment notes. */
export const MatchBreakdown: React.FC<MatchBreakdownProps> = ({ scores, explanation, assessment, fitScore, requirementsResult }) => (
  <section id="eval-qualifications" aria-labelledby="match-heading" className="space-y-4">
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
      <div className="space-y-0.5">
        <h3 id="match-heading" className="text-base font-semibold text-slate-900">
          Match score
        </h3>
        <p className="text-sm text-slate-600">Based on skills, work experience, location, requirements and education.</p>
      </div>
      <ScoreBadge score={fitScore} size="lg" />
    </div>

    {scores ? (
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-300 overflow-hidden rounded-md border border-slate-300 bg-white sm:grid-cols-5 sm:divide-y-0">
        {DIMENSIONS.map((dim, idx) => {
          const status = explanation?.dimensionStatuses?.[dim.key];
          const isNotRequired =
            status === "NOT_REQUIRED" || (!status && explanation?.dimensionsApplicable?.[dim.key] === false && dim.key !== "COMPLIANCE");
          const isPendingOnboarding =
            dim.key === "COMPLIANCE" &&
            (status === "PENDING_ONBOARDING_STAGE" || (!status && explanation?.dimensionsApplicable?.COMPLIANCE === false));
          const isNotAssessed = status === "NOT_ASSESSED";
          const isNeedsReview = status === "NEEDS_REVIEW";
          const isJobUnclear = status === "JOB_UNCLEAR";
          const isMissingMandatory =
            !isNotAssessed && Array.isArray(explanation?.missingMandatory) && explanation.missingMandatory.includes(dim.key);
          // Once requirements are being collected, show their real result instead of "pending".
          const showRequirementsResult = isPendingOnboarding && requirementsResult !== null && requirementsResult.total > 0;

          return (
            <div
              key={dim.key}
              className={`flex min-h-[76px] flex-col items-center justify-center p-3 text-center ${idx === 4 ? "col-span-2 sm:col-span-1" : ""}`}
            >
              <div className="text-xs font-medium text-slate-700">{dim.label}</div>

              {isNotAssessed ? (
                <>
                  <div className="mt-1 text-sm font-semibold text-slate-700">Not assessed</div>
                  <div className="mt-0.5 text-xs leading-tight text-slate-600">Missing in profile</div>
                </>
              ) : isNeedsReview ? (
                <>
                  <div className="mt-1 text-sm font-semibold text-amber-800">Check with candidate</div>
                  <div className="mt-0.5 text-xs leading-tight text-slate-600">Work history unclear</div>
                </>
              ) : isJobUnclear ? (
                <>
                  <div className="mt-1 text-sm font-semibold text-amber-800">Job unclear</div>
                  <div className="mt-0.5 text-xs leading-tight text-slate-600">Not a city or province</div>
                </>
              ) : isNotRequired ? (
                <div className="mt-1 text-sm font-semibold text-slate-600">Not required</div>
              ) : showRequirementsResult ? (
                <>
                  <div className={`mt-1 text-sm font-semibold ${requirementsResult.approved === requirementsResult.total ? "text-emerald-800" : "text-amber-800"}`}>
                    {requirementsResult.approved === requirementsResult.total ? "All approved" : `${requirementsResult.approved} of ${requirementsResult.total} approved`}
                  </div>
                  <div className="mt-0.5 text-xs leading-tight text-slate-600">Documents reviewed so far</div>
                </>
              ) : isPendingOnboarding ? (
                <>
                  <div className="mt-1 text-sm font-semibold text-amber-800">Pending onboarding</div>
                  <div className="mt-0.5 text-xs leading-tight text-slate-600">Collected at requirements stage</div>
                </>
              ) : (
                <div className="mt-0.5 font-mono text-xl font-bold tabular-nums text-slate-950">
                  {Number(scores[dim.scoreKey] ?? 0).toFixed(0)}%
                </div>
              )}

              {isMissingMandatory && (
                <span className="mt-1 inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700">
                  Missing mandatory
                </span>
              )}
            </div>
          );
        })}
      </div>
    ) : (
      <div className="rounded-md border border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600">
        Detailed criteria score breakdown is being calculated.
      </div>
    )}

    {scores && <ScoreReasons statuses={explanation?.dimensionStatuses} explanations={explanation?.dimensionExplanations} />}

    {/* Candidate assessment: identity warning, summary, requirement checklist, other notes */}
    {assessment && <CandidateAssessmentPanel assessment={assessment} />}
  </section>
);
