import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "../../ui";
import { ConfirmDialog, LoadingState } from "../../common";
import { ResumeReviewDialog } from "../../applicant/ResumeReviewDialog";
import type { ProfileEditFormHandle, ProfileFormValues } from "./ProfileEditForm";
import { ResumeSwitcher } from "./ResumeSwitcher";
import type { AtsRequirement } from "./StandardAtsResume";
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
  type EducationDraft,
  type WorkDraft,
} from "./BioDataSectionEditors";
import { taProfileReviewApi, type ReviewProfileDto } from "../../../lib/api/ta-profile-review.api";
import { countActionable, countUndatedWork } from "../../../lib/resume-autofill";
import { notify } from "../../../lib/feedback";
import { plural } from "../../../lib/plural";
import type { ResumeAccept } from "../../../lib/types/applicant.types";

// Only the edit panel needs the personal form, so it loads when the panel opens.
const ProfileEditForm = lazy(() => import("./ProfileEditForm").then((m) => ({ default: m.ProfileEditForm })));

export interface BioDataReviewPanelProps {
  applicationId: number | string;
  profile: any;
  candidateName: string;
  resumeUrl?: string | null;
  email?: string | null;
  /** The application tracking code, when it has one. */
  reference?: string | null;
  requirements?: AtsRequirement[];
  onClose: () => void;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Rows to send for one list: new rows and rows that changed, plus the ids the recruiter removed.
 * Rows left out of the request are not touched on the server.
 */
const diffRows = <D extends { id?: number }, P>(current: D[], initial: D[], toPayload: (rows: D[]) => P[]) => {
  const before = new Map(initial.filter((r) => r.id !== undefined).map((r) => [r.id as number, r]));
  const keptIds = new Set(current.filter((r) => r.id !== undefined).map((r) => r.id as number));
  const removed = [...before.keys()].filter((id) => !keptIds.has(id));
  const changed = current.filter((r) => {
    const old = r.id === undefined ? undefined : before.get(r.id);
    return !old || !same(toPayload([r])[0], toPayload([old])[0]);
  });
  return { rows: toPayload(changed), removed };
};

/** Fields of the personal form that appear on the MEGS resume. */
const resumePersonal = (values: ProfileFormValues | null) =>
  values
    ? {
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        mobileNumber: values.mobileNumber,
        city: values.city,
        province: values.province,
      }
    : {};

const workForResume = (rows: WorkDraft[]) =>
  rows
    .filter((r) => r.company.trim() || r.roleTitle.trim())
    .map((r) => ({
      id: r.key,
      company: r.company,
      roleTitle: r.roleTitle,
      location: r.location,
      startDate: r.startDate,
      endDate: r.isCurrent ? null : r.endDate,
      isCurrent: r.isCurrent,
      summary: r.summary,
    }));

const educationForResume = (rows: EducationDraft[]) =>
  rows
    .filter((r) => r.school.trim())
    .map((r) => ({ id: r.key, school: r.school, degree: r.degree, fieldOfStudy: r.fieldOfStudy, startDate: r.startDate, endDate: r.endDate }));

/**
 * Verify details, full screen: the details on the left, the resume on the right. The resume can be the uploaded
 * file or the MEGS resume, which shows the edits as they are typed. Stacks (resume first) below 1024px.
 */
export const BioDataReviewPanel: React.FC<BioDataReviewPanelProps> = ({
  applicationId,
  profile,
  candidateName,
  resumeUrl,
  email,
  reference,
  requirements,
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
  const [personal, setPersonal] = useState<ProfileFormValues | null>(null);

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

  // The editors restart from the profile once the refreshed one has arrived. Restarting as soon as the refetch
  // call resolves can still hand them the old profile, because the new one reaches this component a moment later.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const profileBeforeApply = useRef<unknown>(null);
  const [reloadWhenFresh, setReloadWhenFresh] = useState(false);
  useEffect(() => {
    if (reloadWhenFresh && profile !== profileBeforeApply.current) {
      setReloadWhenFresh(false);
      setReloadKey((k) => k + 1);
    }
  }, [reloadWhenFresh, profile]);

  const applyMutation = useMutation({
    mutationFn: (accept: ResumeAccept) => {
      profileBeforeApply.current = profileRef.current;
      return taProfileReviewApi.applyResumeMerge(profileId, pending!.parseId, accept);
    },
    onSuccess: async (result) => {
      await Promise.all([refreshAfterSave(), queryClient.invalidateQueries({ queryKey: proposalKey })]);
      setSuggestionsOpen(false);
      // Unchanged data keeps its reference, so arm the reload only when the profile actually changed.
      // A stale flag would fire on a later poll and wipe the recruiter's unsaved edits.
      const fresh = queryClient.getQueryData<any>(["ta", "application", applicationId])?.user?.applicantProfile;
      if (fresh && fresh !== profileBeforeApply.current) setReloadWhenFresh(true);
      notify.success("Resume details saved", "The details you picked were added to the profile.");
      if (result?.changeSummary?.skippedAddressFields?.length) {
        notify.warning("Address not saved", "The resume address was incomplete. Enter the province, city, barangay and postal code.");
      }
    },
    onError: (err: unknown) => notify.error("Could not save resume details", err),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: ReviewProfileDto) => taProfileReviewApi.updateCandidateProfile(profileId, dto),
    onSuccess: async (updated) => {
      await refreshAfterSave();
      notify.success("Changes saved");
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

  const save = () => {
    const personalDto = formRef.current?.collect();
    if (!personalDto) return;
    const found = validateDrafts(work, education);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      notify.error("Check the highlighted fields", Object.values(found)[0]);
      return;
    }
    // Only changed parts are sent; anything left out is not touched.
    const dto: ReviewProfileDto = { ...personalDto };
    if (summary.trim() !== initial.summary.trim()) dto.professionalSummary = summary.trim() || null;
    const jobs = diffRows(work, initial.work, workPayload);
    if (jobs.rows.length > 0) dto.workExperiences = jobs.rows;
    if (jobs.removed.length > 0) dto.removeWorkExperienceIds = jobs.removed;
    const schools = diffRows(education, initial.education, educationPayload);
    if (schools.rows.length > 0) dto.educations = schools.rows;
    if (schools.removed.length > 0) dto.removeEducationIds = schools.removed;
    if (!same(skills, initial.skills)) dto.skills = skills;
    saveMutation.mutate(dto);
  };

  // The MEGS resume is drawn from the stored profile with the unsaved edits on top.
  const draftProfile = useMemo(
    () => ({
      ...profile,
      ...resumePersonal(personal),
      professionalSummary: summary,
      workExperiences: workForResume(work),
      educations: educationForResume(education),
      skills,
    }),
    [profile, personal, summary, work, education, skills],
  );

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bio-review-title" className="fixed inset-0 z-40 flex flex-col bg-white">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-300 px-4 py-3">
        <div className="min-w-0">
          <h2 id="bio-review-title" ref={headingRef} tabIndex={-1} className="truncate text-base font-semibold text-slate-900 focus:outline-none">
            Verify details: {candidateName}
          </h2>
        </div>
        <button type="button" onClick={requestClose} aria-label="Close" className="focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
        <div className="order-first h-[60vh] min-h-0 border-b border-slate-300 p-3 lg:order-last lg:h-auto lg:border-b-0 lg:border-l">
          <ResumeSwitcher resumeUrl={resumeUrl} candidateName={candidateName} megs={{ profile: draftProfile, email, reference, requirements }} />
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

          <Suspense fallback={<LoadingState variant="spinner" message="Loading the form…" className="py-6" />}>
            <ProfileEditForm
              key={`personal-${reloadKey}`}
              formRef={formRef}
              profile={profile}
              onValuesChange={setPersonal}
            />
          </Suspense>
          <SummaryEditor value={summary} onChange={setSummary} />
          <WorkExperienceEditor rows={work} errors={errors} onChange={setWork} />
          <EducationEditor rows={education} errors={errors} onChange={setEducation} />
          <SkillsEditor skills={skills} onChange={setSkills} />
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-300 bg-white px-4 py-3">
        <Button type="button" variant="outline" onClick={requestClose} disabled={saveMutation.isPending}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={save} loading={saveMutation.isPending}>
          Save
        </Button>
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
