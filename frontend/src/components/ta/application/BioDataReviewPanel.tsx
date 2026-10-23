import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "../../ui";
import { ConfirmDialog } from "../../common";
import { ResumeReviewDialog } from "../../applicant/ResumeReviewDialog";
import { InlineResumeViewer } from "../InlineResumeViewer";
import { ProfileEditForm, type ProfileEditFormHandle } from "./ProfileEditForm";
import {
  EducationEditor,
  SkillsEditor,
  SummaryEditor,
  WorkExperienceEditor,
  educationPayload,
  skillNames,
  toEducationDrafts,
  toWorkDrafts,
  validateDrafts,
  workPayload,
  type DraftErrors,
} from "./BioDataSectionEditors";
import { taProfileReviewApi, type ReviewProfileDto } from "../../../lib/api/ta-profile-review.api";
import { countActionable, countUndatedWork } from "../../../lib/resume-autofill";
import { notify } from "../../../lib/feedback";
import { plural } from "../../../lib/plural";
import { formatDate } from "../../../lib/utils";
import type { ResumeAccept } from "../../../lib/types/applicant.types";

export interface BioDataReviewPanelProps {
  applicationId: number | string;
  profile: any;
  candidateName: string;
  candidateInitials: string;
  resumeUrl?: string | null;
  onClose: () => void;
}

/** "Not verified" or "Verified by <name>, <date>". */
export const verificationText = (profile: any): string =>
  profile?.verificationStatus === "VERIFIED"
    ? `Verified${profile.verifiedByName ? ` by ${profile.verifiedByName}` : ""}${profile.verifiedAt ? `, ${formatDate(profile.verifiedAt)}` : ""}`
    : "Not verified";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Full-screen review: editable details on the left, the resume or bio-data on the right.
 * Stacks (resume first) below 1024px. Save keeps the verification status; Save and mark verified sets it.
 */
export const BioDataReviewPanel: React.FC<BioDataReviewPanelProps> = ({
  applicationId,
  profile,
  candidateName,
  candidateInitials,
  resumeUrl,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const formRef = useRef<ProfileEditFormHandle>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const profileId: number = profile.id;

  // Bumped after suggestions are applied so every editor restarts from the saved profile.
  const [reloadKey, setReloadKey] = useState(0);
  const initial = useMemo(
    () => ({
      summary: profile.professionalSummary ?? "",
      work: toWorkDrafts(profile.workExperiences),
      education: toEducationDrafts(profile.educations),
      skills: skillNames(profile.skills),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadKey, profileId],
  );
  const [summary, setSummary] = useState(initial.summary);
  const [work, setWork] = useState(initial.work);
  const [education, setEducation] = useState(initial.education);
  const [skills, setSkills] = useState(initial.skills);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    setSummary(initial.summary);
    setWork(initial.work);
    setEducation(initial.education);
    setSkills(initial.skills);
    setErrors({});
  }, [initial]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const proposalKey = ["ta", "candidate", profileId, "resume-proposal"];
  const proposalQuery = useQuery({
    queryKey: proposalKey,
    queryFn: () => taProfileReviewApi.getResumeProposal(profileId),
  });
  const pending = proposalQuery.data?.pending;
  const suggestionCount = countActionable(pending?.proposal);
  const undatedCount = countUndatedWork(pending?.proposal);

  const refreshAfterSave = () => queryClient.invalidateQueries({ queryKey: ["ta", "application", applicationId] });

  const applyMutation = useMutation({
    mutationFn: (accept: ResumeAccept) => taProfileReviewApi.applyResumeMerge(profileId, pending!.parseId, accept),
    onSuccess: async () => {
      await Promise.all([refreshAfterSave(), queryClient.invalidateQueries({ queryKey: proposalKey })]);
      setSuggestionsOpen(false);
      setReloadKey((k) => k + 1);
      notify.success("Resume details saved", "The details you picked were added to the profile.");
    },
    onError: (err: unknown) => notify.error("Could not save resume details", err),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: ReviewProfileDto) => taProfileReviewApi.updateCandidateProfile(profileId, dto),
    onSuccess: async (updated, dto) => {
      await refreshAfterSave();
      notify.success(dto.markVerified ? "Bio-data verified" : "Changes saved");
      (updated?.warnings ?? []).forEach((warning) => notify.warning("Possible duplicate", warning));
      onClose();
    },
    onError: (err: unknown) => notify.error("Could not save", err),
  });

  const dirty =
    summary.trim() !== initial.summary.trim() ||
    !same(workPayload(work), workPayload(initial.work)) ||
    !same(educationPayload(education), educationPayload(initial.education)) ||
    !same(skills, initial.skills);

  const requestClose = () => {
    if (saveMutation.isPending) return;
    if (dirty || formRef.current?.isDirty()) setConfirmClose(true);
    else onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || suggestionsOpen || confirmClose) return;
      requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const save = (markVerified: boolean) => {
    const personal = formRef.current?.collect();
    if (!personal) return;
    const found = validateDrafts(work, education);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      notify.error("Check the highlighted fields", Object.values(found)[0]);
      return;
    }
    // Only changed sections are sent; a section left out is not touched.
    const dto: ReviewProfileDto = { ...personal };
    if (summary.trim() !== initial.summary.trim()) dto.professionalSummary = summary.trim() || null;
    if (!same(workPayload(work), workPayload(initial.work))) dto.workExperiences = workPayload(work);
    if (!same(educationPayload(education), educationPayload(initial.education))) dto.educations = educationPayload(education);
    if (!same(skills, initial.skills)) dto.skills = skills;
    if (markVerified) dto.markVerified = true;
    saveMutation.mutate(dto);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bio-review-title" className="fixed inset-0 z-40 flex flex-col bg-white">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-300 px-4 py-3">
        <div className="min-w-0">
          <h2 id="bio-review-title" ref={headingRef} tabIndex={-1} className="truncate text-base font-semibold text-slate-900 focus:outline-none">
            Review bio-data: {candidateName}
          </h2>
          <p className="text-sm text-slate-600">{verificationText(profile)}</p>
        </div>
        <button type="button" onClick={requestClose} aria-label="Close" className="focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
        <div className="order-first h-[60vh] min-h-0 border-b border-slate-300 p-3 lg:order-last lg:h-auto lg:border-b-0 lg:border-l">
          <InlineResumeViewer resumeUrl={resumeUrl} candidateName={candidateName} className="h-full" />
        </div>

        <div className="min-h-0 space-y-4 p-4 lg:overflow-y-auto">
          {(suggestionCount > 0 || undatedCount > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-300 bg-slate-50 p-3">
              <p className="text-sm text-slate-900">
                {suggestionCount > 0
                  ? `The resume has ${plural(suggestionCount, "detail")} to review.`
                  : `${plural(undatedCount, "job")} in the resume had no start date. Add them below if needed.`}
              </p>
              {suggestionCount > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={() => setSuggestionsOpen(true)}>
                  Review suggestions
                </Button>
              )}
            </div>
          )}

          <ProfileEditForm
            key={`personal-${reloadKey}`}
            embedded
            formRef={formRef}
            profile={profile}
            candidateInitials={candidateInitials}
            isSaving={saveMutation.isPending}
            onCancel={requestClose}
            onSave={() => undefined}
          />
          <SummaryEditor value={summary} onChange={setSummary} />
          <WorkExperienceEditor rows={work} errors={errors} onChange={setWork} />
          <EducationEditor rows={education} errors={errors} onChange={setEducation} />
          <SkillsEditor skills={skills} onChange={setSkills} />
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-300 bg-white px-4 py-3">
        <Button type="button" variant="outline" onClick={requestClose} disabled={saveMutation.isPending}>
          Cancel
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => save(false)} disabled={saveMutation.isPending}>
            Save
          </Button>
          <Button type="button" variant="primary" onClick={() => save(true)} loading={saveMutation.isPending}>
            Save and mark verified
          </Button>
        </div>
      </footer>

      <ResumeReviewDialog
        staff
        open={suggestionsOpen}
        proposal={pending?.proposal ?? null}
        saving={applyMutation.isPending}
        onSave={(accept) => applyMutation.mutate(accept)}
        onClose={() => setSuggestionsOpen(false)}
      />
      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
        title="Discard your changes?"
        description="Edits you have not saved will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="warning"
      />
    </div>
  );
};
