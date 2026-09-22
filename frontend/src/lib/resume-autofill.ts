import type {
  WorkExperience,
  Education,
  Skill,
  TrainingCertification,
  CharacterReference,
  ExtractedProfileData,
  ExtractedProfileExperience,
  ExtractedProfileEducation,
  ExtractedProfileTraining,
  ExtractedProfileReference,
} from "./types/applicant.types";
import { normalizeTitleCase, normalizeSentenceCase } from "./text-case";

export interface AutoFillDiffResult {
  autoFilledFields: Record<string, string>;
  conflictingFields: Record<string, { current: string; suggested: string }>;
  identicalFields: string[];
  changedOrAddedFields: string[];
}

/**
 * Computes non-destructive diff between currently entered personal form values and extracted resume data.
 * - autoFilledFields: Fields that were empty in the form and can be safely filled.
 * - conflictingFields: Fields that already have a non-empty user-entered value that differs from resume.
 * - identicalFields: Fields where existing user input matches the resume.
 * - changedOrAddedFields: All fields that were either empty and filled or had a differing value updated.
 */
export function computeAutoFillDiff(
  currentForm: Record<string, string | undefined | null>,
  extracted: ExtractedProfileData & Record<string, any>
): AutoFillDiffResult {
  const autoFilledFields: Record<string, string> = {};
  const conflictingFields: Record<string, { current: string; suggested: string }> = {};
  const identicalFields: string[] = [];

  const checkField = (fieldKey: string, extractedVal: string | number | undefined | null) => {
    if (extractedVal === undefined || extractedVal === null) return;
    let strVal = String(extractedVal).trim();
    if (!strVal || strVal.toLowerCase() === "null" || strVal.toLowerCase() === "undefined" || strVal.toLowerCase() === "n/a") {
      return;
    }

    if (fieldKey === "professionalSummary") {
      strVal = normalizeSentenceCase(strVal) || strVal;
    } else if (fieldKey !== "mobileNumber" && fieldKey !== "dateOfBirth") {
      strVal = normalizeTitleCase(strVal) || strVal;
    }

    const currentVal = currentForm[fieldKey];
    const isCurrentEmpty =
      currentVal === undefined || currentVal === null || String(currentVal).trim() === "";

    if (isCurrentEmpty) {
      autoFilledFields[fieldKey] = strVal;
    } else {
      const trimmedCurrent = String(currentVal).trim();
      if (trimmedCurrent.toLowerCase() === strVal.toLowerCase()) {
        identicalFields.push(fieldKey);
      } else {
        conflictingFields[fieldKey] = {
          current: trimmedCurrent,
          suggested: strVal,
        };
      }
    }
  };

  checkField("firstName", extracted.firstName || extracted.first_name);
  checkField("middleName", extracted.middleName || extracted.middle_name);
  checkField("lastName", extracted.lastName || extracted.last_name);
  checkField("mobileNumber", extracted.mobileNumber || extracted.mobile_number || extracted.contactNumber || extracted.phone);
  checkField("dateOfBirth", extracted.dateOfBirth || extracted.birthDate || extracted.birth_date || extracted.dob);
  checkField("birthPlace", extracted.birthPlace || extracted.placeOfBirth || extracted.birth_place || extracted.place_of_birth);
  checkField("gender", extracted.gender || extracted.sex);
  checkField("nationality", extracted.nationality || extracted.citizenship);
  checkField("civilStatus", extracted.civilStatus || extracted.civil_status || extracted.maritalStatus);
  checkField("religion", extracted.religion);
  checkField("height", extracted.height);
  checkField("weight", extracted.weight);
  checkField("province", extracted.province);
  checkField("city", extracted.city);
  checkField("address", extracted.address);
  checkField("preferredWorkLocations", extracted.preferredWorkLocations || extracted.preferred_work_locations);
  checkField("professionalSummary", extracted.professionalSummary || extracted.professional_summary || extracted.summary);

  const changedOrAddedFields = Array.from(
    new Set([...Object.keys(autoFilledFields), ...Object.keys(conflictingFields)])
  );

  return {
    autoFilledFields,
    conflictingFields,
    identicalFields,
    changedOrAddedFields,
  };
}

const normalizeDateStr = (d?: string | null) => (d ? d.substring(0, 10) : "");

/**
 * Filters and compares extracted work experiences against existing records.
 * Identifies both newly added and updated/modified experiences.
 */
export function filterDuplicateExperiences(
  existing: WorkExperience[] = [],
  extracted: ExtractedProfileExperience[] = []
): { newItems: ExtractedProfileExperience[]; updatedItems: ExtractedProfileExperience[]; duplicateCount: number; totalCount: number } {
  let duplicateCount = 0;
  const newItems: ExtractedProfileExperience[] = [];
  const updatedItems: ExtractedProfileExperience[] = [];

  for (const exp of extracted) {
    const compNorm = (exp.company || "").trim().toLowerCase();
    const roleNorm = (exp.roleTitle || "").trim().toLowerCase();

    const existingMatch = existing.find((e) => {
      const exCompNorm = (e.company || "").trim().toLowerCase();
      const exRoleNorm = (e.roleTitle || "").trim().toLowerCase();
      return exCompNorm === compNorm && exRoleNorm === roleNorm;
    });

    if (existingMatch) {
      duplicateCount++;
      const hasChanged =
        (exp.location || "").trim().toLowerCase() !== (existingMatch.location || "").trim().toLowerCase() ||
        normalizeDateStr(exp.startDate) !== normalizeDateStr(existingMatch.startDate) ||
        normalizeDateStr(exp.endDate) !== normalizeDateStr(existingMatch.endDate) ||
        Boolean(exp.isCurrent) !== Boolean(existingMatch.isCurrent) ||
        (exp.summary || "").trim() !== (existingMatch.summary || "").trim();

      if (hasChanged) {
        updatedItems.push(exp);
      }
    } else {
      newItems.push(exp);
    }
  }

  return {
    newItems,
    updatedItems,
    duplicateCount,
    totalCount: newItems.length + updatedItems.length,
  };
}

/**
 * Filters and compares extracted education records against existing records.
 * Identifies both newly added and updated/modified educations.
 */
export function filterDuplicateEducations(
  existing: Education[] = [],
  extracted: ExtractedProfileEducation[] = []
): { newItems: ExtractedProfileEducation[]; updatedItems: ExtractedProfileEducation[]; duplicateCount: number; totalCount: number } {
  let duplicateCount = 0;
  const newItems: ExtractedProfileEducation[] = [];
  const updatedItems: ExtractedProfileEducation[] = [];

  for (const edu of extracted) {
    const schoolNorm = (edu.school || "").trim().toLowerCase();
    const degreeNorm = (edu.degree || "").trim().toLowerCase();

    const existingMatch = existing.find((e) => {
      const exSchoolNorm = (e.school || "").trim().toLowerCase();
      const exDegreeNorm = (e.degree || "").trim().toLowerCase();
      return exSchoolNorm === schoolNorm && (!degreeNorm || exDegreeNorm === degreeNorm);
    });

    if (existingMatch) {
      duplicateCount++;
      const hasChanged =
        (edu.fieldOfStudy || "").trim().toLowerCase() !== (existingMatch.fieldOfStudy || "").trim().toLowerCase() ||
        normalizeDateStr(edu.startDate) !== normalizeDateStr(existingMatch.startDate) ||
        normalizeDateStr(edu.endDate) !== normalizeDateStr(existingMatch.endDate) ||
        (edu.notes || "").trim() !== (existingMatch.notes || "").trim();

      if (hasChanged) {
        updatedItems.push(edu);
      }
    } else {
      newItems.push(edu);
    }
  }

  return {
    newItems,
    updatedItems,
    duplicateCount,
    totalCount: newItems.length + updatedItems.length,
  };
}

/**
 * Normalizes and filters out skills that are already registered.
 */
export function filterDuplicateSkills(
  existing: (Skill | string | any)[] = [],
  extracted: string[] = []
): { newItems: string[]; duplicateCount: number; totalCount: number } {
  const existingSet = new Set(
    existing
      .map((s) => {
        if (typeof s === "string") return s.trim().toLowerCase();
        if (s && typeof s === "object") {
          const name = s.name || s.skillName || s.skill?.name || "";
          return String(name).trim().toLowerCase();
        }
        return "";
      })
      .filter(Boolean)
  );

  let duplicateCount = 0;
  const newItems: string[] = [];
  const addedLower = new Set<string>();

  for (const skill of extracted) {
    const trimmed = (skill || "").trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed || existingSet.has(lower) || addedLower.has(lower)) {
      if (existingSet.has(lower)) duplicateCount++;
    } else {
      newItems.push(trimmed);
      addedLower.add(lower);
    }
  }

  return {
    newItems,
    duplicateCount,
    totalCount: newItems.length,
  };
}

/**
 * Filters and compares extracted trainings against existing records.
 */
export function filterDuplicateTrainings(
  existing: TrainingCertification[] = [],
  extracted: ExtractedProfileTraining[] = []
): { newItems: ExtractedProfileTraining[]; updatedItems: ExtractedProfileTraining[]; duplicateCount: number; totalCount: number } {
  let duplicateCount = 0;
  const newItems: ExtractedProfileTraining[] = [];
  const updatedItems: ExtractedProfileTraining[] = [];

  for (const t of extracted) {
    const titleNorm = (t.title || "").trim().toLowerCase();

    const existingMatch = existing.find(
      (ex) => (ex.title || "").trim().toLowerCase() === titleNorm
    );

    if (existingMatch) {
      duplicateCount++;
      const hasChanged =
        (t.provider || "").trim().toLowerCase() !== (existingMatch.provider || "").trim().toLowerCase() ||
        (t.certificateNo || "").trim() !== (existingMatch.certificateNo || "").trim() ||
        (t.notes || "").trim() !== (existingMatch.notes || "").trim() ||
        normalizeDateStr(t.completionDate) !== normalizeDateStr(existingMatch.completionDate);

      if (hasChanged) {
        updatedItems.push(t);
      }
    } else {
      newItems.push(t);
    }
  }

  return {
    newItems,
    updatedItems,
    duplicateCount,
    totalCount: newItems.length + updatedItems.length,
  };
}

/**
 * Filters and compares extracted character references against existing records.
 */
export function filterDuplicateReferences(
  existing: CharacterReference[] = [],
  extracted: ExtractedProfileReference[] = []
): { newItems: ExtractedProfileReference[]; updatedItems: ExtractedProfileReference[]; duplicateCount: number; totalCount: number } {
  let duplicateCount = 0;
  const newItems: ExtractedProfileReference[] = [];
  const updatedItems: ExtractedProfileReference[] = [];

  for (const ref of extracted) {
    if (!ref || !ref.name || !ref.name.trim()) continue;
    const nameNorm = ref.name.trim().toLowerCase();
    const phoneNorm = (ref.phone || "").trim().toLowerCase();
    const emailNorm = (ref.email || "").trim().toLowerCase();

    const existingMatch = existing.find((ex) => {
      const exNameNorm = (ex.name || "").trim().toLowerCase();
      const exPhoneNorm = (ex.phone || "").trim().toLowerCase();
      const exEmailNorm = (ex.email || "").trim().toLowerCase();

      if (exNameNorm === nameNorm) {
        if (phoneNorm && exPhoneNorm && phoneNorm === exPhoneNorm) return true;
        if (emailNorm && exEmailNorm && emailNorm === exEmailNorm) return true;
        if (!phoneNorm && !emailNorm && !exPhoneNorm && !exEmailNorm) return true;
      }
      return false;
    });

    if (existingMatch) {
      duplicateCount++;
      const hasChanged =
        (ref.relationship || "").trim().toLowerCase() !== (existingMatch.relationship || "").trim().toLowerCase() ||
        phoneNorm !== (existingMatch.phone || "").trim().toLowerCase() ||
        emailNorm !== (existingMatch.email || "").trim().toLowerCase() ||
        (ref.notes || "").trim() !== (existingMatch.notes || "").trim();

      if (hasChanged) {
        updatedItems.push(ref);
      }
    } else {
      newItems.push(ref);
    }
  }

  return {
    newItems,
    updatedItems,
    duplicateCount,
    totalCount: newItems.length + updatedItems.length,
  };
}

