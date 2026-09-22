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
    <section className="flex flex-col gap-5 border-b border-[#D9E2EC] pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {profile?.photoUrl && !imgError ? (
          <img src={profile.photoUrl} alt="Candidate identity" className="h-20 w-20 shrink-0 rounded border border-[#D9E2EC] object-cover" onError={onImageError} />
        ) : (
          <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-[#EAF0F7] text-xl font-semibold text-[#0B315D] ring-1 ring-inset ring-[#0B315D]/20">
            {candidateInitials}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-[#102A43]">
            {[profile?.firstName, profile?.middleName, profile?.lastName].filter(Boolean).join(" ") || "Your candidate profile"}
          </h2>
          <p className="mt-1 text-sm text-[#627D98]">{user?.email || "Applicant account"}</p>
          <p className="mt-1 text-sm text-[#627D98]">{profile?.mobileNumber || "Add a contact number"}{profile?.city ? ` · ${profile.city}` : ""}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <div className="w-full text-right text-xs text-[#627D98] sm:w-auto sm:text-left">
          <span className="block font-semibold text-[#102A43]">Candidate photo</span>
          <span>PNG or JPG up to 5 MB</span>
        </div>
        <label className="inline-flex min-h-9 cursor-pointer items-center rounded-md border border-[#D9E2EC] bg-white px-3 text-xs sm:text-sm font-medium text-[#0B315D] hover:bg-[#EAF0F7] hover:text-[#082747] transition-colors focus-within:ring-2 focus-within:ring-[#0B315D] focus-within:ring-offset-2">
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

    <section id="overview-resume-panel" tabIndex={-1} className="border border-[#D9E2EC] border-l-4 border-l-[#0B315D] bg-[#EAF0F7]/60 rounded-lg p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]" aria-labelledby="overview-resume-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0B315D]">Resume to profile</p>
          <h2 id="overview-resume-heading" className="mt-1 text-base font-semibold text-[#102A43]">Save time on profile setup</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#102A43]">Upload one PDF and MEGS fills supported contact details, experience, education, and skills for you. Review and correct anything before you continue.</p>
        </div>
        {profile?.resumeUrl && <Button type="button" variant="outline" size="sm" onClick={onViewPdf}>View PDF</Button>}
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-[#D9E2EC] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm text-[#102A43]">
          <p className="font-semibold">{profile?.resumeUrl ? "Resume on file" : "No resume uploaded yet"}</p>
          <p className="mt-1 text-xs text-[#627D98]">PDF only, up to 5 MB. Existing profile details stay unchanged when MEGS fills empty fields.</p>
        </div>
        <label className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-[#0B315D] px-4 text-xs sm:text-sm font-medium text-white hover:bg-[#082747] focus-within:ring-2 focus-within:ring-[#0B315D] focus-within:ring-offset-2 transition-colors">
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
      {resumeReview && (() => {
        const total =
          resumeReview.personalFields.length +
          resumeReview.workExperienceCount +
          resumeReview.educationCount +
          resumeReview.skillsCount +
          resumeReview.trainingCount +
          resumeReview.referenceCount;

        const personalLabel =
          resumeReview.personalFields.length === 1
            ? "1 personal field"
            : `${resumeReview.personalFields.length} personal fields`;
        const expLabel =
          resumeReview.workExperienceCount === 1
            ? "1 experience"
            : `${resumeReview.workExperienceCount} experiences`;
        const eduLabel =
          resumeReview.educationCount === 1
            ? "1 education record"
            : `${resumeReview.educationCount} education records`;
        const skillLabel =
          resumeReview.skillsCount === 1
            ? "1 skill"
            : `${resumeReview.skillsCount} skills`;
        const certLabel =
          resumeReview.trainingCount === 1
            ? "1 certification"
            : `${resumeReview.trainingCount} certifications`;
        const refLabel =
          resumeReview.referenceCount === 1
            ? "1 reference"
            : `${resumeReview.referenceCount} references`;

        if (total === 0) {
          return (
            <div role="status" aria-live="polite" className="mt-4 border-t border-[#D9E2EC] pt-4">
              <p className="text-sm font-semibold text-[#102A43]">
                Resume parsed — your profile is already up to date with this resume.
              </p>
              <p className="mt-1 text-xs text-[#627D98]">
                All details in this resume match your existing profile records.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onReviewResume}>
                Review profile details
              </Button>
            </div>
          );
        }

        return (
          <div role="status" aria-live="polite" className="mt-4 border-t border-[#D9E2EC] pt-4">
            <p className="text-sm font-semibold text-[#102A43]">
              Resume parsed — your profile has been updated automatically. Review the details below.
            </p>
            <p className="mt-1 text-xs text-[#102A43]">
              {personalLabel}, {expLabel}, {eduLabel}, {skillLabel}, {certLabel}, and {refLabel} added or updated.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onReviewResume}>
              Review filled details
            </Button>
          </div>
        );
      })()}
    </section>

    <section aria-labelledby="overview-qualifications-heading">
      <div className="flex items-center justify-between gap-3 border-b border-[#D9E2EC] pb-3">
        <div>
          <h2 id="overview-qualifications-heading" className="text-base font-semibold text-[#102A43]">Profile highlights</h2>
          <p className="mt-1 text-sm text-[#627D98]">The details recruiters use first when reviewing your profile.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate("qualifications")}>Manage details</Button>
      </div>
      <dl className="grid grid-cols-1 divide-y divide-[#D9E2EC] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="py-3 sm:pr-5"><dt className="text-xs font-semibold uppercase tracking-wide text-[#627D98]">Current experience</dt><dd className="mt-1 text-sm text-[#102A43]">{profile?.workExperiences?.find((item) => item.isCurrent)?.roleTitle || profile?.workExperiences?.[0]?.roleTitle || "Add your work history"}</dd></div>
        <div className="py-3 sm:pl-5"><dt className="text-xs font-semibold uppercase tracking-wide text-[#627D98]">Education</dt><dd className="mt-1 text-sm text-[#102A43]">{profile?.educations?.[0]?.degree || "Add your education"}</dd></div>
        <div className="border-t border-[#D9E2EC] py-3 sm:pr-5"><dt className="text-xs font-semibold uppercase tracking-wide text-[#627D98]">Skills</dt><dd className="mt-1 text-sm text-[#102A43]">{skills.length ? `${skills.slice(0, 6).join(", ")}${skills.length > 6 ? ` +${skills.length - 6} more` : ""}` : "Add skills"}</dd></div>
        <div className="border-t border-[#D9E2EC] py-3 sm:pl-5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-[#627D98]">Supporting details</dt>
          <dd className="mt-1 text-sm text-[#102A43]">
            {(() => {
              const trainCount = profile?.trainings?.length || 0;
              const refCount = profile?.characterReferences?.length || 0;
              if (trainCount === 0 && refCount === 0) {
                return "Add certifications or references";
              }
              const parts: string[] = [];
              if (trainCount > 0) {
                parts.push(`${trainCount} ${trainCount === 1 ? "certification" : "certifications"}`);
              } else {
                parts.push("0 certifications");
              }
              if (refCount > 0) {
                parts.push(`${refCount} ${refCount === 1 ? "reference" : "references"}`);
              } else {
                parts.push("0 references");
              }
              return parts.join(" · ");
            })()}
          </dd>
        </div>
      </dl>
    </section>
  </div>
);
