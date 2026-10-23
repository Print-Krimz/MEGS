import { api } from "./client";
import type { ApplicantProfile, ApplyResumeResult, PendingResumeProposal, ResumeAccept } from "../types/applicant.types";
import type { UpdateCandidateProfileDto } from "../types/ta.types";

export interface ReviewWorkExperience {
  id?: number;
  company: string;
  roleTitle: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  summary?: string | null;
}

export interface ReviewEducation {
  id?: number;
  school: string;
  degree?: string | null;
  fieldOfStudy?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

/** Personal fields plus optional full-list sections. A section left out is not changed; a submitted list replaces it. */
export interface ReviewProfileDto extends UpdateCandidateProfileDto {
  professionalSummary?: string | null;
  workExperiences?: ReviewWorkExperience[];
  educations?: ReviewEducation[];
  skills?: string[];
  markVerified?: boolean;
}

export const taProfileReviewApi = {
  getResumeProposal: (candidateId: number | string) =>
    api.get<PendingResumeProposal | null>(`/api/ta/candidates/${candidateId}/resume-proposal`),

  applyResumeMerge: (candidateId: number | string, parseId: number, accept: ResumeAccept) =>
    api.post<ApplyResumeResult>(`/api/ta/candidates/${candidateId}/resume-merge/${parseId}/apply`, { accept }),

  updateCandidateProfile: (candidateId: number | string, data: ReviewProfileDto) =>
    api.patch<ApplicantProfile & { warnings?: string[] }>(`/api/ta/candidates/${candidateId}`, data),
};
