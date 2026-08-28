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

export interface AutoFillDiffResult {
  autoFilledFields: Record<string, string>;
  conflictingFields: Record<string, { current: string; suggested: string }>;
  identicalFields: string[];
}

/**
 * Computes non-destructive diff between currently entered personal form values and extracted resume data.
 * - autoFilledFields: Fields that were empty in the form and can be safely filled.
 * - conflictingFields: Fields that already have a non-empty user-entered value that differs from resume.
 * - identicalFields: Fields where existing user input matches the resume.
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
    const strVal = String(extractedVal).trim();
    if (!strVal || strVal.toLowerCase() === "null" || strVal.toLowerCase() === "undefined" || strVal.toLowerCase() === "n/a") {
      return;
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

  return {
    autoFilledFields,
    conflictingFields,
    identicalFields,
  };
}

/**
 * Filters out extracted work experiences that match existing records by company and roleTitle.
 */
export function filterDuplicateExperiences(
  existing: WorkExperience[] = [],
  extracted: ExtractedProfileExperience[] = []
): { newItems: ExtractedProfileExperience[]; duplicateCount: number } {
  let duplicateCount = 0;
  const newItems: ExtractedProfileExperience[] = [];

  for (const exp of extracted) {
    const compNorm = (exp.company || "").trim().toLowerCase();
    const roleNorm = (exp.roleTitle || "").trim().toLowerCase();

    const isDuplicate = existing.some((e) => {
      const exCompNorm = (e.company || "").trim().toLowerCase();
      const exRoleNorm = (e.roleTitle || "").trim().toLowerCase();
      return exCompNorm === compNorm && exRoleNorm === roleNorm;
    });

    if (isDuplicate) {
      duplicateCount++;
    } else {
      newItems.push(exp);
    }
  }

  return { newItems, duplicateCount };
}

/**
 * Filters out extracted education records that match existing records by school and degree.
 */
export function filterDuplicateEducations(
  existing: Education[] = [],
  extracted: ExtractedProfileEducation[] = []
): { newItems: ExtractedProfileEducation[]; duplicateCount: number } {
  let duplicateCount = 0;
  const newItems: ExtractedProfileEducation[] = [];

  for (const edu of extracted) {
    const schoolNorm = (edu.school || "").trim().toLowerCase();
    const degreeNorm = (edu.degree || "").trim().toLowerCase();

    const isDuplicate = existing.some((e) => {
      const exSchoolNorm = (e.school || "").trim().toLowerCase();
      const exDegreeNorm = (e.degree || "").trim().toLowerCase();
      return exSchoolNorm === schoolNorm && (!degreeNorm || exDegreeNorm === degreeNorm);
    });

    if (isDuplicate) {
      duplicateCount++;
    } else {
      newItems.push(edu);
    }
  }

  return { newItems, duplicateCount };
}

/**
 * Normalizes and filters out skills that are already registered.
 */
export function filterDuplicateSkills(
  existing: (Skill | string)[] = [],
  extracted: string[] = []
): { newItems: string[]; duplicateCount: number } {
  const existingSet = new Set(
    existing.map((s) => (typeof s === "string" ? s : s.name).trim().toLowerCase())
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

  return { newItems, duplicateCount };
}

/**
 * Filters out extracted trainings that match existing records by title.
 */
export function filterDuplicateTrainings(
  existing: TrainingCertification[] = [],
  extracted: ExtractedProfileTraining[] = []
): { newItems: ExtractedProfileTraining[]; duplicateCount: number } {
  let duplicateCount = 0;
  const newItems: ExtractedProfileTraining[] = [];

  for (const t of extracted) {
    const titleNorm = (t.title || "").trim().toLowerCase();

    const isDuplicate = existing.some(
      (ex) => (ex.title || "").trim().toLowerCase() === titleNorm
    );

    if (isDuplicate) {
      duplicateCount++;
    } else {
      newItems.push(t);
    }
  }

  return { newItems, duplicateCount };
}

/**
 * Filters out extracted character references that match existing records by name and phone/email.
 */
export function filterDuplicateReferences(
  existing: CharacterReference[] = [],
  extracted: ExtractedProfileReference[] = []
): { newItems: ExtractedProfileReference[]; duplicateCount: number } {
  let duplicateCount = 0;
  const newItems: ExtractedProfileReference[] = [];

  for (const ref of extracted) {
    if (!ref || !ref.name || !ref.name.trim()) continue;
    const nameNorm = ref.name.trim().toLowerCase();
    const phoneNorm = (ref.phone || "").trim().toLowerCase();
    const emailNorm = (ref.email || "").trim().toLowerCase();

    const isDuplicate = existing.some((ex) => {
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

    if (isDuplicate) {
      duplicateCount++;
    } else {
      newItems.push(ref);
    }
  }

  return { newItems, duplicateCount };
}

