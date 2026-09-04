import React from "react";
import { CheckCircle2, Clock, Bookmark } from "lucide-react";
import { ApplicationStatus } from "../../lib/types/enums";

export interface ApplicationStatusStepperProps {
  currentStatus: string;
  className?: string;
  compact?: boolean;
}

export type CandidateStage = "APPLIED" | "SCREENING" | "INTERVIEW" | "DECISION";

interface StageInfo {
  key: CandidateStage;
  label: string;
  description: string;
}

const STAGES: StageInfo[] = [
  { key: "APPLIED", label: "Applied", description: "Application submitted & received" },
  { key: "SCREENING", label: "Screening", description: "Initial recruiter review & phone screen" },
  { key: "INTERVIEW", label: "Interview", description: "Technical or client interview assessment" },
  { key: "DECISION", label: "Decision", description: "Offer, onboarding, or future pool" },
];

export function mapStatusToStage(status: string): {
  stage: CandidateStage;
  stageIndex: number;
  stageTone: "blue" | "amber" | "indigo" | "emerald" | "violet" | "slate";
  message: string;
} {
  const norm = (status || "").toUpperCase();

  // Terminal or late stages
  if (norm === ApplicationStatus.DEPLOYED) {
    return {
      stage: "DECISION",
      stageIndex: 3,
      stageTone: "emerald",
      message: "Placement confirmed! You are actively deployed at the work site.",
    };
  }
  if (
    norm === ApplicationStatus.HIRED ||
    norm === ApplicationStatus.COMPLIANCE ||
    norm === ApplicationStatus.CONTRACT_AND_ORIENTATION ||
    norm === ApplicationStatus.ONBOARDING
  ) {
    return {
      stage: "DECISION",
      stageIndex: 3,
      stageTone: "emerald",
      message: "Congratulations! You have been selected. Document compliance and contract orientation are underway.",
    };
  }
  if (norm === ApplicationStatus.TALENT_POOL) {
    return {
      stage: "DECISION",
      stageIndex: 3,
      stageTone: "violet",
      message: "While not selected for this specific opening, your profile is prioritized in our verified talent pool for upcoming matches.",
    };
  }
  if (norm === ApplicationStatus.ARCHIVED || norm === ApplicationStatus.BACKOUT) {
    return {
      stage: "DECISION",
      stageIndex: 3,
      stageTone: "slate",
      message: "This application cycle has concluded.",
    };
  }

  // Interview stage
  if (
    norm === ApplicationStatus.FINAL_INTERVIEW ||
    norm === ApplicationStatus.CLIENT_ENDORSEMENT ||
    norm.includes("INTERVIEW")
  ) {
    return {
      stage: "INTERVIEW",
      stageIndex: 2,
      stageTone: "indigo",
      message: "You have advanced to the interview stage. Please check your interview schedule and notes.",
    };
  }

  // Screening stage
  if (
    norm === ApplicationStatus.INITIAL_SCREENING ||
    norm.includes("SCREEN")
  ) {
    return {
      stage: "SCREENING",
      stageIndex: 1,
      stageTone: "amber",
      message: "Our recruitment specialists are screening your credentials and verifying qualifications.",
    };
  }

  // Default: Applied
  return {
    stage: "APPLIED",
    stageIndex: 0,
    stageTone: "blue",
    message: "Your application is safely received and queued for recruiter evaluation.",
  };
}

export const ApplicationStatusStepper: React.FC<ApplicationStatusStepperProps> = ({
  currentStatus,
  className = "",
  compact = false,
}) => {
  const { stageIndex, stageTone, message } = mapStatusToStage(currentStatus);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 4-Step Visual Track */}
      <div className="relative">
        {/* Connecting Progress Bar Background */}
        <div className="absolute top-3.5 left-6 right-6 h-0.5 bg-slate-200 -z-0" />
        
        {/* Active Filled Progress Bar */}
        <div
          className="absolute top-3.5 left-6 h-0.5 bg-blue-600 transition-all duration-300 -z-0"
          style={{ width: `${(stageIndex / (STAGES.length - 1)) * 100 * 0.88}%` }}
        />

        <div className="relative z-10 flex items-center justify-between">
          {STAGES.map((s, idx) => {
            const isCompleted = idx < stageIndex;
            const isCurrent = idx === stageIndex;

            return (
              <div key={s.key} className="flex flex-col items-center text-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isCompleted
                      ? "bg-blue-600 text-white shadow-xs"
                      : isCurrent
                      ? "bg-white border-2 border-blue-600 text-blue-600 shadow-xs ring-4 ring-blue-50"
                      : "bg-white border border-slate-300 text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <span
                  className={`mt-1.5 text-xs font-semibold ${
                    isCurrent
                      ? "text-blue-700 font-bold"
                      : isCompleted
                      ? "text-slate-800"
                      : "text-slate-400"
                  }`}
                >
                  {s.label}
                </span>

                {!compact && (
                  <span className="hidden sm:block text-[11px] text-slate-500 max-w-[100px] leading-tight mt-0.5">
                    {s.description}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Contextual Guidance Callout */}
      {!compact && (
        <div
          className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
            stageTone === "emerald"
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
              : stageTone === "violet"
              ? "bg-purple-50/80 border-purple-200 text-purple-900"
              : stageTone === "indigo"
              ? "bg-indigo-50/80 border-indigo-200 text-indigo-900"
              : stageTone === "amber"
              ? "bg-amber-50/80 border-amber-200 text-amber-900"
              : "bg-blue-50/80 border-blue-200 text-blue-900"
          }`}
        >
          {stageTone === "emerald" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : stageTone === "violet" ? (
            <Bookmark className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          ) : (
            <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold">Next step: </span>
            <span>{message}</span>
          </div>
        </div>
      )}
    </div>
  );
};
