import prisma from '../../utils/prisma.js';
import { revalidateApplicantProfile } from "../scoring/scoring-configuration.service.js";
import { normalizeComplianceDocumentType } from "../scoring/scoring.dimensions.js";

const queueProfileRevalidation = (profileId: number) => {
  void revalidateApplicantProfile(profileId).catch((error) => console.error("[Scoring] failed to queue profile revalidation", error));
};

export const getApplicantProfile = async (userId: string) => {
  const profile = await prisma.applicantProfile.findUnique({
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

  if (!profile) return null;

  return {
    ...profile,
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
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

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
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

  await prisma.workExperience.deleteMany({
    where: { id, applicantProfileId: profile.id },
  });
  queueProfileRevalidation(profile.id);
};

export const addEducationService = async (userId: string, data: any) => {
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

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
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

  await prisma.education.deleteMany({
    where: { id, applicantProfileId: profile.id },
  });
  queueProfileRevalidation(profile.id);
};

// Atomically syncs applicant skill associations and registers new unique skill tags
export const updateSkillsService = async (userId: string, skillNames: string[]) => {
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

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
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

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
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

  await prisma.trainingCertification.deleteMany({
    where: { id, applicantProfileId: profile.id },
  });
  queueProfileRevalidation(profile.id);
};

export const addReferenceService = async (userId: string, data: any) => {
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

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
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

  await prisma.characterReference.deleteMany({
    where: { id, applicantProfileId: profile.id },
  });
};

export const addAssetService = async (userId: string, fileUrl: string, data: any) => {
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

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
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

  await prisma.asset.deleteMany({
    where: { id, applicantProfileId: profile.id },
  });
  queueProfileRevalidation(profile.id);
};

export const updateProfilePhotoService = async (userId: string, photoUrl: string) => {
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

  const updated = await prisma.applicantProfile.update({
    where: { id: profile.id },
    data: { photoUrl },
  });
  queueProfileRevalidation(profile.id);
  return updated;
};

export const updateProfileResumeService = async (userId: string, resumeUrl: string) => {
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

  const updated = await prisma.applicantProfile.update({
    where: { id: profile.id },
    data: { resumeUrl },
  });
  queueProfileRevalidation(profile.id);
  return updated;
};
