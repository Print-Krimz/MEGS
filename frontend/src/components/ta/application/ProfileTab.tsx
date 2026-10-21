import React from "react";
import { BackgroundSection, type BackgroundSectionProps } from "./BackgroundSection";
import { InterviewList, type InterviewListProps } from "./InterviewList";
import { MatchBreakdown, type MatchBreakdownProps } from "./MatchBreakdown";

export interface ProfileTabProps {
  match: MatchBreakdownProps;
  interviews: InterviewListProps;
  background: BackgroundSectionProps;
  /** "View resume" control, shown when the resume is not beside the content. */
  resumeAction?: React.ReactNode;
  /** The verify form. Shown first while the recruiter edits, so it sits beside the resume. */
  editForm?: React.ReactNode;
  /** Personal details, when they are not in the resume column. */
  personal?: React.ReactNode;
}

/** Profile and interviews, in the order a recruiter decides: score and reasons, interviews, then background. */
export const ProfileTab: React.FC<ProfileTabProps> = ({ match, interviews, background, resumeAction, editForm, personal }) => (
  <div className="space-y-8">
    {resumeAction}
    {editForm}
    <MatchBreakdown {...match} />
    <InterviewList {...interviews} />
    <BackgroundSection {...background} />
    {personal}
  </div>
);
