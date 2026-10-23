import type {
  ResumeAccept,
  ResumeProposal,
  ResumePersonalProposal,
} from "./types/applicant.types";

/** Same labels the profile form uses. */
export const RESUME_FIELD_LABELS: Record<string, string> = {
  firstName: "First Name",
  middleName: "Middle Name",
  lastName: "Last Name",
  mobileNumber: "Contact Number",
  gender: "Gender",
  dateOfBirth: "Date of Birth",
  birthPlace: "Place of Birth",
  nationality: "Nationality",
  civilStatus: "Civil Status",
  religion: "Religion",
  height: "Height (cm)",
  weight: "Weight (kg)",
  province: "Province or region",
  city: "City or municipality",
  barangay: "Barangay",
  postalCode: "Postal code",
  address: "Complete Residential Address",
  preferredWorkLocations: "Preferred Work Locations",
  professionalSummary: "Professional Summary",
};

export const resumeFieldLabel = (field: string) => RESUME_FIELD_LABELS[field] ?? field;

export const formatResumeValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "—" : String(value);

/** Personal rows the applicant can act on: new values and conflicts. "same" rows are hidden. */
export const actionablePersonal = (proposal: ResumeProposal): ResumePersonalProposal[] =>
  proposal.personal.filter((row) => row.status === "suggested" || row.status === "conflict");

const isNew = (row: { status: string }) => row.status === "new";
const needsDate = (row: { status: string }) => row.status === "needs_date";

/** Number of things the applicant can select in the review dialog. Zero means nothing to review. */
export function countActionable(proposal: ResumeProposal | null | undefined): number {
  if (!proposal) return 0;
  return (
    actionablePersonal(proposal).length +
    proposal.workExperiences.filter(isNew).length +
    proposal.educations.filter(isNew).length +
    proposal.skills.filter(isNew).length +
    proposal.trainings.filter(isNew).length +
    proposal.references.filter(isNew).length
  );
}

/** Work entries from the resume that were not added because no start date was found. */
export const countUndatedWork = (proposal: ResumeProposal | null | undefined): number =>
  proposal ? proposal.workExperiences.filter(needsDate).length : 0;

export interface ResumeSelection {
  /** Personal fields to save (suggested values and chosen conflicts). */
  personal: Set<string>;
  /** Conflicting fields where the applicant chose the resume value. */
  overwrite: Set<string>;
  workExperiences: Set<number>;
  educations: Set<number>;
  skills: Set<string>;
  trainings: Set<number>;
  references: Set<number>;
}

/** Suggested fields and new items start checked; conflicts keep the saved value. */
export function initialSelection(proposal: ResumeProposal): ResumeSelection {
  return {
    personal: new Set(proposal.personal.filter((r) => r.status === "suggested").map((r) => r.field)),
    overwrite: new Set(),
    workExperiences: new Set(proposal.workExperiences.filter(isNew).map((r) => r.index)),
    educations: new Set(proposal.educations.filter(isNew).map((r) => r.index)),
    skills: new Set(proposal.skills.filter(isNew).map((r) => r.name)),
    trainings: new Set(proposal.trainings.filter(isNew).map((r) => r.index)),
    references: new Set(proposal.references.filter(isNew).map((r) => r.index)),
  };
}

/**
 * Builds the apply request. A conflict is sent only when the reviewer chose the resume value.
 * Verified (locked) fields are dropped unless `allowLocked` is set, which only Talent Acquisition review uses.
 */
export function buildAccept(proposal: ResumeProposal, selection: ResumeSelection, options: { allowLocked?: boolean } = {}): ResumeAccept {
  const conflicts = new Set(proposal.personal.filter((r) => r.status === "conflict").map((r) => r.field));
  const locked = new Set(options.allowLocked ? [] : proposal.personal.filter((r) => r.locked).map((r) => r.field));
  const overwrite = [...selection.overwrite].filter((f) => conflicts.has(f) && !locked.has(f));
  const suggested = [...selection.personal].filter((f) => !conflicts.has(f));
  return {
    personal: [...suggested, ...overwrite],
    overwrite,
    workExperiences: [...selection.workExperiences],
    educations: [...selection.educations],
    skills: [...selection.skills],
    trainings: [...selection.trainings],
    references: [...selection.references],
  };
}

export const selectionIsEmpty = (accept: ResumeAccept) =>
  accept.personal.length +
    accept.workExperiences.length +
    accept.educations.length +
    accept.skills.length +
    accept.trainings.length +
    accept.references.length ===
  0;
