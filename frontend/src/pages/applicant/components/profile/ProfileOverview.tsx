import React from "react";
import { Button } from "../../../../components/ui";
import { ProfileHealthMeter } from "../../../../components/applicant/ProfileHealthMeter";
import type { ApplicantProfile } from "../../../../lib/types/applicant.types";
import type { ProfileSection } from "./profile-navigation";
import type { ResumeReviewSummary } from "./profile-types";

export interface ProfileOverviewProps {
  profile?: ApplicantProfile | null;
  user?: { email?: string | null } | null;
  candidateInitials: string;
  imgError: boolean;
  onImageError: () => void;
  onPhotoFile: (file: File) => void;
  photoUploadPending: boolean;
  onResumeFile: (file: File) => void;
  resumeUploadPending: boolean;
  resumeReview: ResumeReviewSummary | null;
  onViewPdf: () => void;
  onReviewResume: () => void;
  onNavigate: (section: ProfileSection) => void;
  onJumpToSection: (target: string) => void;
  skills: string[];
}

export const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  profile,
  user,
  candidateInitials,
  imgError,
  onImageError,
  onPhotoFile,
  photoUploadPending,
  onResumeFile,
  resumeUploadPending,
  resumeReview,
  onViewPdf,
  onReviewResume,
  onNavigate,
  onJumpToSection,
  skills,
}) => (
  <div className="space-y-5">
    <h2 className="sr-only">Overview</h2>
    <section className="flex flex-col gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {profile?.photoUrl && !imgError ? (
          <img src={profile.photoUrl} alt="Candidate identity" className="h-20 w-20 shrink-0 rounded border border-slate-300 object-cover" onError={onImageError} />
        ) : (
          <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-[#E8EEF6] text-xl font-semibold text-[#0F294A] ring-1 ring-inset ring-[#0F294A]/20">
            {candidateInitials}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-slate-950">
            {[profile?.firstName, profile?.middleName, profile?.lastName].filter(Boolean).join(" ") || "Your candidate profile"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{user?.email || "Applicant account"}</p>
          <p className="mt-1 text-sm text-slate-600">{profile?.mobileNumber || "Add a contact number"}{profile?.city ? ` · ${profile.city}` : ""}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <div className="w-full text-right text-xs text-slate-500 sm:w-auto sm:text-left">
          <span className="block font-semibold text-slate-700">Candidate photo</span>
          <span>PNG or JPG up to 5 MB</span>
        </div>
        <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-[#0F294A] focus-within:ring-offset-2">
          <input
            data-testid="photo-upload-input"
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            className="sr-only"
            disabled={photoUploadPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPhotoFile(file);
              event.target.value = "";
            }}
          />
          {photoUploadPending ? "Uploading photo…" : "Change photo"}
        </label>
      </div>
    </section>

    <ProfileHealthMeter profile={profile} onJumpToTab={onJumpToSection} />

    <section id="overview-resume-panel" tabIndex={-1} className="border-l-4 border-[#0F294A] bg-[#E8EEF6]/60 rounded-r-lg px-4 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A]" aria-labelledby="overview-resume-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0F294A]">Resume to profile</p>
          <h2 id="overview-resume-heading" className="mt-1 text-base font-semibold text-slate-950">Save time on profile setup</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-700">Upload one PDF and MEGS fills supported contact details, experience, education, and skills for you. Review and correct anything before you continue.</p>
        </div>
        {profile?.resumeUrl && <Button type="button" variant="outline" size="sm" onClick={onViewPdf}>View PDF</Button>}
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-[#0F294A]/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm text-slate-800">
          <p className="font-semibold">{profile?.resumeUrl ? "Resume on file" : "No resume uploaded yet"}</p>
          <p className="mt-1 text-xs text-slate-600">PDF only, up to 5 MB. Existing profile details stay unchanged when MEGS fills empty fields.</p>
        </div>
        <label className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center rounded-md bg-[#0F294A] px-4 text-sm font-semibold text-white hover:bg-[#163B66] focus-within:ring-2 focus-within:ring-[#0F294A] focus-within:ring-offset-2 transition-colors">
          <input
            data-testid="resume-autofill-upload-input"
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            disabled={resumeUploadPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onResumeFile(file);
              event.target.value = "";
            }}
          />
          {resumeUploadPending ? "Reading your resume…" : profile?.resumeUrl ? "Replace resume" : "Upload resume"}
        </label>
      </div>
      {resumeReview && (
        <div role="status" aria-live="polite" className="mt-4 border-t border-[#0F294A]/15 pt-4">
          <p className="text-sm font-semibold text-slate-900">Resume parsed — your profile has been filled automatically. Review the details below.</p>
          <p className="mt-1 text-xs text-slate-700">{resumeReview.personalFields.length} personal fields, {resumeReview.workExperienceCount} experiences, {resumeReview.educationCount} education records, {resumeReview.skillsCount} skills, {resumeReview.trainingCount} certifications, and {resumeReview.referenceCount} references added or filled.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onReviewResume}>Review filled details</Button>
        </div>
      )}
    </section>

    <section aria-labelledby="overview-qualifications-heading">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 id="overview-qualifications-heading" className="text-base font-semibold text-slate-950">Profile highlights</h2>
          <p className="mt-1 text-sm text-slate-600">The details recruiters use first when reviewing your profile.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate("qualifications")}>Manage details</Button>
      </div>
      <dl className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="py-3 sm:pr-5"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current experience</dt><dd className="mt-1 text-sm text-slate-900">{profile?.workExperiences?.find((item) => item.isCurrent)?.roleTitle || profile?.workExperiences?.[0]?.roleTitle || "Add your work history"}</dd></div>
        <div className="py-3 sm:pl-5"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Education</dt><dd className="mt-1 text-sm text-slate-900">{profile?.educations?.[0]?.degree || "Add your education"}</dd></div>
        <div className="border-t border-slate-200 py-3 sm:pr-5"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</dt><dd className="mt-1 text-sm text-slate-900">{skills.length ? `${skills.slice(0, 6).join(", ")}${skills.length > 6 ? ` +${skills.length - 6} more` : ""}` : "Add skills"}</dd></div>
        <div className="border-t border-slate-200 py-3 sm:pl-5"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supporting details</dt><dd className="mt-1 text-sm text-slate-900">{(profile?.trainings?.length || 0) + (profile?.characterReferences?.length || 0)} training and reference records</dd></div>
      </dl>
    </section>
  </div>
);
