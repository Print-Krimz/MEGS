import React from "react";
import { BackgroundSection, type BackgroundSectionProps } from "./BackgroundSection";
import { MatchBreakdown, type MatchBreakdownProps } from "./MatchBreakdown";
import { CandidateAssessmentPanel, type CandidateAssessment } from "../CandidateAssessmentPanel";

export interface ProfileTabProps {
  /** Personal and contact details, first: the recruiter checks who the candidate is before the score. */
  personal: React.ReactNode;
  match: MatchBreakdownProps;
  assessment: CandidateAssessment | null;
  background: BackgroundSectionProps;
}

/** Who, how well they match, what the assessment found, then the work and education history. */
export const ProfileTab: React.FC<ProfileTabProps> = ({ personal, match, assessment, background }) => (
  <div className="space-y-8">
    {personal}
    <MatchBreakdown {...match} />
    {assessment && <CandidateAssessmentPanel assessment={assessment} />}
    <BackgroundSection {...background} />
  </div>
);
