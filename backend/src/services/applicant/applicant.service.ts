import prisma from '../../utils/prisma.js';
import { revalidateApplicantProfile } from "../scoring/scoring-configuration.service.js";
import { normalizeComplianceDocumentType } from "../scoring/scoring.dimensions.js";
import { resolveDocumentSignedUrl } from "../document/document.service.js";
// @ts-ignore
import pdfParseModule from "pdf-parse/lib/pdf-parse.js";
const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
  typeof pdfParseModule === "function" ? pdfParseModule : ((pdfParseModule as any)?.default ?? pdfParseModule);
import { extractResumeProfileData, type ExtractedProfileData } from "../../utils/gemini.js";

const queueProfileRevalidation = (profileId: number) => {
  try {
    const res = revalidateApplicantProfile(profileId);
    if (res && typeof res.catch === "function") {
      void res.catch((error) => console.error("[Scoring] failed to queue profile revalidation", error));
    }
  } catch {
    // scoring queue revalidation is advisory
  }
};

export const ensureApplicantProfile = async (userId: string) => {
  let profile = await prisma.applicantProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.applicantProfile.create({
      data: {
        userId,
        firstName: "",
        lastName: "",
      },
    });
  }

  return profile;
};

export const getApplicantProfile = async (userId: string, requesterRole: string = "APPLICANT") => {
  let profile = await prisma.applicantProfile.findUnique({
    where: { userId },
    include: {
      workExperiences: true,
      educations: true,
      skills: { include: { skill: true } },
      trainings: true,
      assets: true,
      characterReferences: true,
    },
  });

  if (!profile && requesterRole === "APPLICANT") {
    profile = await prisma.applicantProfile.create({
      data: {
        userId,
        firstName: "",
        lastName: "",
      },
      include: {
        workExperiences: true,
        educations: true,
        skills: { include: { skill: true } },
        trainings: true,
        assets: true,
        characterReferences: true,
      },
    });
  }

  if (!profile) return null;

  let photoUrl = profile.photoUrl;
  if (profile.photoUrl) {
    try {
      const resolved = await resolveDocumentSignedUrl(profile.photoUrl, userId, requesterRole);
      if (resolved) photoUrl = resolved;
    } catch {
      // fallback to stored photoUrl
    }
  }

  let resumeUrl = profile.resumeUrl;
  if (profile.resumeUrl) {
    try {
      const resolved = await resolveDocumentSignedUrl(profile.resumeUrl, userId, requesterRole);
      if (resolved) resumeUrl = resolved;
    } catch {
      // fallback to stored resumeUrl
    }
  }

  return {
    ...profile,
    photoUrl,
    resumeUrl,
    skills: profile.skills.map((s) => s.skill.name),
  };
};

export const upsertApplicantProfile = async (userId: string, data: any) => {
  const sanitizeString = (val: any) => (val !== undefined && val !== null ? String(val).trim() || null : undefined);
  const sanitizeNumber = (val: any) => (val !== undefined && val !== null && val !== "" && !isNaN(Number(val)) ? Number(val) : val === null ? null : undefined);
  const sanitizeDate = (val: any) => (val ? new Date(val) : val === null ? null : undefined);

  const updateData: Record<string, any> = {};
  if (data.firstName !== undefined) updateData.firstName = String(data.firstName).trim();
  if (data.lastName !== undefined) updateData.lastName = String(data.lastName).trim();
  if (data.middleName !== undefined) updateData.middleName = sanitizeString(data.middleName);
  if (data.mobileNumber !== undefined) updateData.mobileNumber = sanitizeString(data.mobileNumber);
  if (data.gender !== undefined) updateData.gender = sanitizeString(data.gender);
  if (data.province !== undefined) updateData.province = sanitizeString(data.province);
  if (data.city !== undefined) updateData.city = sanitizeString(data.city);
  if (data.dateOfBirth !== undefined) updateData.dateOfBirth = sanitizeDate(data.dateOfBirth);
  if (data.birthPlace !== undefined) updateData.birthPlace = sanitizeString(data.birthPlace);
  if (data.nationality !== undefined) updateData.nationality = sanitizeString(data.nationality);
  if (data.civilStatus !== undefined) updateData.civilStatus = sanitizeString(data.civilStatus);
  if (data.height !== undefined) updateData.height = sanitizeNumber(data.height);
  if (data.weight !== undefined) updateData.weight = sanitizeNumber(data.weight);
  if (data.religion !== undefined) updateData.religion = sanitizeString(data.religion);
  if (data.address !== undefined) updateData.address = sanitizeString(data.address);
  if (data.preferredWorkLocations !== undefined) updateData.preferredWorkLocations = sanitizeString(data.preferredWorkLocations);
  if (data.pagibig !== undefined) updateData.pagibig = sanitizeString(data.pagibig);
  if (data.philhealth !== undefined) updateData.philhealth = sanitizeString(data.philhealth);
  if (data.sss !== undefined) updateData.sss = sanitizeString(data.sss);
  if (data.tin !== undefined) updateData.tin = sanitizeString(data.tin);
  if (data.professionalSummary !== undefined) updateData.professionalSummary = sanitizeString(data.professionalSummary);
  if (data.emergencyContactName !== undefined) updateData.emergencyContactName = sanitizeString(data.emergencyContactName);
  if (data.emergencyContactRelationship !== undefined) updateData.emergencyContactRelationship = sanitizeString(data.emergencyContactRelationship);
  if (data.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = sanitizeString(data.emergencyContactPhone);
  if (data.emergencyContactAddress !== undefined) updateData.emergencyContactAddress = sanitizeString(data.emergencyContactAddress);
  if (data.additionalNotes !== undefined) updateData.additionalNotes = sanitizeString(data.additionalNotes);

  const existing = await prisma.applicantProfile.findUnique({ where: { userId } });

  let profile;
  if (existing) {
    profile = await prisma.applicantProfile.update({
      where: { userId },
      data: updateData,
    });
  } else {
    profile = await prisma.applicantProfile.create({
      data: {
        userId,
        firstName: updateData.firstName || "",
        lastName: updateData.lastName || "",
        middleName: updateData.middleName ?? null,
        mobileNumber: updateData.mobileNumber ?? null,
        gender: updateData.gender ?? null,
        province: updateData.province ?? null,
        city: updateData.city ?? null,
        dateOfBirth: updateData.dateOfBirth ?? null,
        birthPlace: updateData.birthPlace ?? null,
        nationality: updateData.nationality ?? null,
        civilStatus: updateData.civilStatus ?? null,
        height: updateData.height ?? null,
        weight: updateData.weight ?? null,
        religion: updateData.religion ?? null,
        address: updateData.address ?? null,
        preferredWorkLocations: updateData.preferredWorkLocations ?? null,
        pagibig: updateData.pagibig ?? null,
        philhealth: updateData.philhealth ?? null,
        sss: updateData.sss ?? null,
        tin: updateData.tin ?? null,
        professionalSummary: updateData.professionalSummary ?? null,
        emergencyContactName: updateData.emergencyContactName ?? null,
        emergencyContactRelationship: updateData.emergencyContactRelationship ?? null,
        emergencyContactPhone: updateData.emergencyContactPhone ?? null,
        emergencyContactAddress: updateData.emergencyContactAddress ?? null,
        additionalNotes: updateData.additionalNotes ?? null,
      },
    });
  }

  queueProfileRevalidation(profile.id);
  return profile;
};

export const addWorkExperienceService = async (userId: string, data: any) => {
  const profile = await ensureApplicantProfile(userId);

  const experience = await prisma.workExperience.create({
    data: {
      applicantProfileId: profile.id,
      company: data.company,
      roleTitle: data.roleTitle,
      location: data.location,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      isCurrent: data.isCurrent || false,
      summary: data.summary,
    },
  });
  queueProfileRevalidation(profile.id);
  return experience;
};

export const deleteWorkExperienceService = async (userId: string, id: number) => {
  const profile = await ensureApplicantProfile(userId);

  await prisma.workExperience.deleteMany({
    where: { id, applicantProfileId: profile.id },
  });
  queueProfileRevalidation(profile.id);
};

export const addEducationService = async (userId: string, data: any) => {
  const profile = await ensureApplicantProfile(userId);

  const education = await prisma.education.create({
    data: {
      applicantProfileId: profile.id,
      school: data.institution || data.school,
      degree: data.degree,
      fieldOfStudy: data.fieldOfStudy,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      notes: data.notes,
    },
  });
  queueProfileRevalidation(profile.id);
  return education;
};

export const deleteEducationService = async (userId: string, id: number) => {
  const profile = await ensureApplicantProfile(userId);

  await prisma.education.deleteMany({
    where: { id, applicantProfileId: profile.id },
  });
  queueProfileRevalidation(profile.id);
};

// Atomically syncs applicant skill associations and registers new unique skill tags
export const updateSkillsService = async (userId: string, skillNames: string[]) => {
  const profile = await ensureApplicantProfile(userId);

  await prisma.$transaction(async (tx) => {
    await tx.applicantSkill.deleteMany({ where: { applicantProfileId: profile.id } });

    for (const name of skillNames) {
      const normalized = name.trim().toLowerCase();
      let skill = await tx.skill.findUnique({ where: { name: normalized } });
      if (!skill) {
        skill = await tx.skill.create({
          data: { name: normalized },
        });
      }
      await tx.applicantSkill.create({
        data: { applicantProfileId: profile.id, skillId: skill.id },
      });
    }
  });

  queueProfileRevalidation(profile.id);
  return await txGetSkills(profile.id);
};

const txGetSkills = async (profileId: number) => {
  const currentSkills = await prisma.applicantSkill.findMany({
    where: { applicantProfileId: profileId },
    include: { skill: true },
  });
  return currentSkills.map(s => s.skill.name);
};

export const addTrainingService = async (userId: string, data: any) => {
  const profile = await ensureApplicantProfile(userId);

  const training = await prisma.trainingCertification.create({
    data: {
      applicantProfileId: profile.id,
      title: data.title,
      provider: data.provider,
      certificateNo: data.certificateNo,
      notes: data.notes,
      completionDate: data.completionDate ? new Date(data.completionDate) : null,
    },
  });
  queueProfileRevalidation(profile.id);
  return training;
};

export const deleteTrainingService = async (userId: string, id: number) => {
  const profile = await ensureApplicantProfile(userId);

  await prisma.trainingCertification.deleteMany({
    where: { id, applicantProfileId: profile.id },
  });
  queueProfileRevalidation(profile.id);
};

export const addReferenceService = async (userId: string, data: any) => {
  const profile = await ensureApplicantProfile(userId);

  return await prisma.characterReference.create({
    data: {
      applicantProfileId: profile.id,
      name: data.name,
      relationship: data.relationship,
      phone: data.phone,
      email: data.email,
      notes: data.notes,
    },
  });
};

export const deleteReferenceService = async (userId: string, id: number) => {
  const profile = await ensureApplicantProfile(userId);

  await prisma.characterReference.deleteMany({
    where: { id, applicantProfileId: profile.id },
  });
};

export const addAssetService = async (userId: string, fileUrl: string, data: any) => {
  const profile = await ensureApplicantProfile(userId);

  const asset = await prisma.asset.create({
    data: {
      applicantProfileId: profile.id,
      label: data.label,
      documentType: normalizeComplianceDocumentType(data.label),
      fileUrl,
      notes: data.notes,
    },
  });
  queueProfileRevalidation(profile.id);
  return asset;
};

export const deleteAssetService = async (userId: string, id: number) => {
  const profile = await ensureApplicantProfile(userId);

  await prisma.asset.deleteMany({
    where: { id, applicantProfileId: profile.id },
  });
  queueProfileRevalidation(profile.id);
};

export const updateProfilePhotoService = async (userId: string, photoUrl: string) => {
  const profile = await ensureApplicantProfile(userId);

  const updated = await prisma.applicantProfile.update({
    where: { id: profile.id },
    data: { photoUrl },
  });
  queueProfileRevalidation(updated.id);

  let resolvedPhotoUrl = photoUrl;
  try {
    const resolved = await resolveDocumentSignedUrl(photoUrl, userId, "APPLICANT");
    if (resolved) resolvedPhotoUrl = resolved;
  } catch {
    // fallback
  }

  return {
    ...updated,
    photoUrl: resolvedPhotoUrl,
  };
};

export const updateProfileResumeService = async (userId: string, resumeUrl: string) => {
  const profile = await ensureApplicantProfile(userId);

  const updated = await prisma.applicantProfile.update({
    where: { id: profile.id },
    data: { resumeUrl },
  });

  try {
    const activeApplications = await prisma.application.findMany({
      where: {
        userId,
        status: { notIn: ["DEPLOYED"] },
        isArchived: false,
      },
      select: { id: true, jobPostingId: true },
    });

    if (activeApplications.length > 0) {
      await prisma.application.updateMany({
        where: {
          id: { in: activeApplications.map((a) => a.id) },
        },
        data: { resumeUrl },
      });

      const { enqueueResumeAnalysis } = await import("../../workers/resume.worker.js");
      const { revalidateApplication } = await import("../scoring/scoring-configuration.service.js");

      for (const app of activeApplications) {
        try {
          enqueueResumeAnalysis(app.id);
          const res = revalidateApplication(app.id, app.jobPostingId);
          if (res && typeof res.catch === "function") {
            void res.catch((err) =>
              console.error("[Scoring] failed to queue application revalidation", err)
            );
          }
        } catch (queueErr: any) {
          console.warn(`[Resume Update] Failed to queue analysis for application #${app.id}:`, queueErr.message);
        }
      }
    }
  } catch (syncErr: any) {
    console.warn("[Resume Update] Failed to synchronize active applications:", syncErr.message);
  }

  queueProfileRevalidation(updated.id);
  return updated;
};

// Extracts candidate profile information from a resume PDF buffer
export const processResumeExtractionService = async (
  buffer: Buffer
): Promise<{ extractedData: ExtractedProfileData | null; extractionStatus: "SUCCESS" | "UNAVAILABLE" }> => {
  try {
    const parsed = await pdfParse(buffer);
    const text = parsed?.text ? parsed.text.trim() : "";
    if (!text) {
      return { extractedData: null, extractionStatus: "UNAVAILABLE" };
    }

    const extracted = await extractResumeProfileData(text);
    return { extractedData: extracted, extractionStatus: "SUCCESS" };
  } catch (err: any) {
    console.warn("[Resume Parser] Text extraction or Gemini analysis unavailable:", err.message);
    return { extractedData: null, extractionStatus: "UNAVAILABLE" };
  }
};

export interface ApplyExtractedProfileDto {
  personalDetails?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    mobileNumber?: string;
    gender?: string;
    province?: string;
    city?: string;
    dateOfBirth?: string;
    birthPlace?: string;
    nationality?: string;
    civilStatus?: string;
    religion?: string;
    height?: number | string;
    weight?: number | string;
    address?: string;
    preferredWorkLocations?: string;
    professionalSummary?: string;
  };
  overwriteExistingPersonal?: boolean;
  workExperiences?: Array<{
    company: string;
    roleTitle: string;
    location?: string;
    startDate: string;
    endDate?: string | null;
    isCurrent?: boolean;
    summary?: string;
  }>;
  educations?: Array<{
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string;
  }>;
  skills?: string[];
  trainings?: Array<{
    title: string;
    provider?: string;
    completionDate?: string | null;
    certificateNo?: string;
    notes?: string;
  }>;
  characterReferences?: Array<{
    name: string;
    relationship?: string;
    company?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }>;
}

// Atomically and non-destructively applies extracted resume data into the candidate's profile
export const applyExtractedProfileService = async (
  userId: string,
  payload: ApplyExtractedProfileDto
) => {
  let profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.applicantProfile.create({
      data: {
        userId,
        firstName: payload.personalDetails?.firstName || "",
        lastName: payload.personalDetails?.lastName || "",
      },
    });
  }

  const sanitizeString = (val: any) => (val !== undefined && val !== null ? String(val).trim() || null : undefined);
  const sanitizeNumber = (val: any) => (val !== undefined && val !== null && val !== "" && !isNaN(Number(val)) ? Number(val) : val === null ? null : undefined);
  const sanitizeDate = (val: any) => (val ? new Date(val) : val === null ? null : undefined);

  // 1. Personal Details Merge (Non-destructive unless overwriteExistingPersonal is true)
  if (payload.personalDetails) {
    const updateData: Record<string, any> = {};
    const personal = payload.personalDetails;
    const overwrite = Boolean(payload.overwriteExistingPersonal);

    const fieldsToProcess: (keyof typeof personal)[] = [
      "firstName",
      "middleName",
      "lastName",
      "mobileNumber",
      "gender",
      "province",
      "city",
      "birthPlace",
      "nationality",
      "civilStatus",
      "religion",
      "address",
      "preferredWorkLocations",
      "professionalSummary",
    ];

    for (const field of fieldsToProcess) {
      const incomingVal = sanitizeString(personal[field]);
      if (incomingVal !== undefined && incomingVal !== null) {
        const existingVal = (profile as any)[field];
        const isExistingEmpty = existingVal === null || existingVal === undefined || String(existingVal).trim() === "";
        if (overwrite || isExistingEmpty) {
          updateData[field] = incomingVal;
        }
      }
    }

    if (personal.dateOfBirth) {
      const incomingDob = sanitizeDate(personal.dateOfBirth);
      const isDobEmpty = !profile.dateOfBirth;
      if (incomingDob && (overwrite || isDobEmpty)) {
        updateData.dateOfBirth = incomingDob;
      }
    }

    if (personal.height !== undefined && personal.height !== null) {
      const incomingHeight = sanitizeNumber(personal.height);
      const isHeightEmpty = profile.height === null || profile.height === undefined;
      if (incomingHeight !== undefined && (overwrite || isHeightEmpty)) {
        updateData.height = incomingHeight;
      }
    }

    if (personal.weight !== undefined && personal.weight !== null) {
      const incomingWeight = sanitizeNumber(personal.weight);
      const isWeightEmpty = profile.weight === null || profile.weight === undefined;
      if (incomingWeight !== undefined && (overwrite || isWeightEmpty)) {
        updateData.weight = incomingWeight;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.applicantProfile.update({
        where: { id: profile.id },
        data: updateData,
      });
    }
  }

  // 2. Work Experiences Deduplication & Import
  if (payload.workExperiences && payload.workExperiences.length > 0) {
    const existingExps = await prisma.workExperience.findMany({
      where: { applicantProfileId: profile.id },
    });

    for (const exp of payload.workExperiences) {
      const companyNorm = exp.company.trim().toLowerCase();
      const roleNorm = exp.roleTitle.trim().toLowerCase();
      const existing = existingExps.find(
        (e) => e.company.trim().toLowerCase() === companyNorm && e.roleTitle.trim().toLowerCase() === roleNorm
      );

      if (existing) {
        await prisma.workExperience.update({
          where: { id: existing.id },
          data: {
            location: sanitizeString(exp.location) ?? existing.location,
            startDate: exp.startDate ? new Date(exp.startDate) : existing.startDate,
            endDate: exp.endDate !== undefined ? (exp.endDate ? new Date(exp.endDate) : null) : existing.endDate,
            isCurrent: exp.isCurrent !== undefined ? Boolean(exp.isCurrent) : existing.isCurrent,
            summary: sanitizeString(exp.summary) ?? existing.summary,
          },
        });
      } else {
        await prisma.workExperience.create({
          data: {
            applicantProfileId: profile.id,
            company: exp.company.trim(),
            roleTitle: exp.roleTitle.trim(),
            location: sanitizeString(exp.location),
            startDate: exp.startDate ? new Date(exp.startDate) : new Date(),
            endDate: exp.endDate ? new Date(exp.endDate) : null,
            isCurrent: Boolean(exp.isCurrent),
            summary: sanitizeString(exp.summary),
          },
        });
      }
    }
  }

  // 3. Educations Deduplication & Import
  if (payload.educations && payload.educations.length > 0) {
    const existingEdus = await prisma.education.findMany({
      where: { applicantProfileId: profile.id },
    });

    for (const edu of payload.educations) {
      const schoolNorm = edu.school.trim().toLowerCase();
      const degreeNorm = (edu.degree || "").trim().toLowerCase();
      const existing = existingEdus.find(
        (e) => e.school.trim().toLowerCase() === schoolNorm && (e.degree || "").trim().toLowerCase() === degreeNorm
      );

      if (existing) {
        await prisma.education.update({
          where: { id: existing.id },
          data: {
            fieldOfStudy: sanitizeString(edu.fieldOfStudy) ?? existing.fieldOfStudy,
            startDate: edu.startDate ? new Date(edu.startDate) : existing.startDate,
            endDate: edu.endDate !== undefined ? (edu.endDate ? new Date(edu.endDate) : null) : existing.endDate,
            notes: sanitizeString(edu.notes) ?? existing.notes,
          },
        });
      } else {
        await prisma.education.create({
          data: {
            applicantProfileId: profile.id,
            school: edu.school.trim(),
            degree: sanitizeString(edu.degree) || "Degree / Certificate",
            fieldOfStudy: sanitizeString(edu.fieldOfStudy) || "General",
            startDate: edu.startDate ? new Date(edu.startDate) : null,
            endDate: edu.endDate ? new Date(edu.endDate) : null,
            notes: sanitizeString(edu.notes),
          },
        });
      }
    }
  }

  // 4. Skills Deduplication & Import
  if (payload.skills && payload.skills.length > 0) {
    const currentSkills = await prisma.applicantSkill.findMany({
      where: { applicantProfileId: profile.id },
      include: { skill: true },
    });
    const existingSkillNames = new Set(currentSkills.map((s) => s.skill.name.trim().toLowerCase()));

    for (const skillName of payload.skills) {
      const normalized = skillName.trim().toLowerCase();
      if (normalized && !existingSkillNames.has(normalized)) {
        let skill = await prisma.skill.findUnique({ where: { name: normalized } });
        if (!skill) {
          skill = await prisma.skill.create({ data: { name: normalized } });
        }
        await prisma.applicantSkill.create({
          data: { applicantProfileId: profile.id, skillId: skill.id },
        });
        existingSkillNames.add(normalized);
      }
    }
  }

  // 5. Trainings & Certifications Deduplication & Import
  if (payload.trainings && payload.trainings.length > 0) {
    const existingTrainings = await prisma.trainingCertification.findMany({
      where: { applicantProfileId: profile.id },
    });

    for (const training of payload.trainings) {
      const titleNorm = training.title.trim().toLowerCase();
      const existing = existingTrainings.find(
        (t) => t.title.trim().toLowerCase() === titleNorm
      );

      if (existing) {
        await prisma.trainingCertification.update({
          where: { id: existing.id },
          data: {
            provider: sanitizeString(training.provider) ?? existing.provider,
            completionDate: training.completionDate ? new Date(training.completionDate) : existing.completionDate,
            certificateNo: sanitizeString(training.certificateNo) ?? existing.certificateNo,
            notes: sanitizeString(training.notes) ?? existing.notes,
          },
        });
      } else {
        await prisma.trainingCertification.create({
          data: {
            applicantProfileId: profile.id,
            title: training.title.trim(),
            provider: sanitizeString(training.provider),
            completionDate: training.completionDate ? new Date(training.completionDate) : null,
            certificateNo: sanitizeString(training.certificateNo),
            notes: sanitizeString(training.notes),
          },
        });
      }
    }
  }

  // 6. Character References Deduplication & Import
  if (payload.characterReferences && payload.characterReferences.length > 0) {
    const existingRefs = (await prisma.characterReference.findMany({
      where: { applicantProfileId: profile.id },
    })) || [];

    for (const ref of payload.characterReferences) {
      if (!ref || !ref.name || !ref.name.trim()) continue;
      const nameNorm = ref.name.trim().toLowerCase();
      const phoneNorm = (ref.phone || "").trim().toLowerCase();
      const emailNorm = (ref.email || "").trim().toLowerCase();

      const existing = existingRefs.find((r) => {
        const exName = r.name.trim().toLowerCase();
        const exPhone = (r.phone || "").trim().toLowerCase();
        const exEmail = (r.email || "").trim().toLowerCase();

        if (exName === nameNorm) {
          if (phoneNorm && exPhone && phoneNorm === exPhone) return true;
          if (emailNorm && exEmail && emailNorm === exEmail) return true;
          if (!phoneNorm && !emailNorm && !exPhone && !exEmail) return true;
        }
        return false;
      });

      let relationship = sanitizeString(ref.relationship);
      const company = sanitizeString(ref.company);
      if (company) {
        relationship = relationship ? `${relationship} at ${company}` : company;
      }

      if (existing) {
        await prisma.characterReference.update({
          where: { id: existing.id },
          data: {
            relationship: relationship ?? existing.relationship,
            phone: sanitizeString(ref.phone) ?? existing.phone,
            email: sanitizeString(ref.email) ?? existing.email,
            notes: sanitizeString(ref.notes) ?? existing.notes,
          },
        });
      } else {
        await prisma.characterReference.create({
          data: {
            applicantProfileId: profile.id,
            name: ref.name.trim(),
            relationship: relationship ?? null,
            phone: sanitizeString(ref.phone) ?? null,
            email: sanitizeString(ref.email) ?? null,
            notes: sanitizeString(ref.notes) ?? null,
          },
        });
      }
    }
  }

  queueProfileRevalidation(profile.id);
  return await getApplicantProfile(userId);
};

