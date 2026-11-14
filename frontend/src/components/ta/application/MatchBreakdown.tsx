import React from "react";
import { ScoreReasons } from "../ScoreReasons";
import type { DimensionExplanation } from "../../../lib/types/ta.types";
import { confidenceDetails } from "../../../lib/match-confidence";

export interface ScoreExplanation {
  activeTotalWeight?: number;
  embeddingUsed?: boolean;
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
  /**
   * Requirement progress once the application reached the requirements stage.
   * Null before that: the score then says "Not yet".
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

const toPercent = (value: number | string | null | undefined) => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n) ? undefined : n;
};

/**
 * The five scores in one row, then the reasons behind the weakest ones. The overall score is in the
 * summary above, so it is not repeated here.
 */
export const MatchBreakdown: React.FC<MatchBreakdownProps> = ({ scores, explanation, requirementsResult }) => {
  const { level: confidence, reasons } = confidenceDetails(explanation);
  return (
  <section id="eval-qualifications" aria-labelledby="match-heading" className="space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-slate-200 pb-2">
      <h3 id="match-heading" className="text-base font-semibold text-slate-900">
        AI match
      </h3>
      <p className="text-sm font-medium text-slate-700">{confidence ? `Confidence: ${confidence}` : "Confidence unavailable"}</p>
    </div>

    <div className="text-sm text-slate-600">
      <p>Confidence reflects the evidence available for the match, not candidate suitability or a probability of accuracy.</p>
      {confidence ? <p>{reasons.join(" ")}</p> : <p>There is not enough scoring information to assess confidence.</p>}
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
                <div className="mt-1 text-sm font-semibold text-slate-600" title="Checked once the candidate reaches the requirements stage">
                  Not yet
                </div>
              ) : (
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-slate-950">
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

    {scores && (
      <ScoreReasons
        statuses={explanation?.dimensionStatuses}
        explanations={explanation?.dimensionExplanations}
        scores={{
          SKILLS: toPercent(scores.skillsScore),
          EXPERIENCE: toPercent(scores.experienceScore),
          LOCATION: toPercent(scores.locationScore),
          EDUCATION_CERTIFICATIONS: toPercent(scores.educationCertificationScore),
        }}
      />
    )}
  </section>
  );
};
