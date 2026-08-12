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

  if (!profile) throw new Error("Profile not found. Please create your profile first.");

  return {
    ...profile,
    skills: profile.skills.map((s) => s.skill.name),
  };
};

export const upsertApplicantProfile = async (userId: string, data: any) => {
  const profileData = {
    firstName: data.firstName,
    middleName: data.middleName,
    lastName: data.lastName,
    mobileNumber: data.mobileNumber,
    gender: data.gender,
    province: data.province,
    city: data.city,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : new Date(),
    birthPlace: data.birthPlace,
    nationality: data.nationality,
    civilStatus: data.civilStatus,
    height: data.height,
    weight: data.weight,
    religion: data.religion,
    address: data.address,
    preferredWorkLocations: data.preferredWorkLocations,
    pagibig: data.pagibig,
    philhealth: data.philhealth,
    sss: data.sss,
    tin: data.tin,
    professionalSummary: data.professionalSummary,
    emergencyContactName: data.emergencyContactName,
    emergencyContactRelationship: data.emergencyContactRelationship,
    emergencyContactPhone: data.emergencyContactPhone,
    emergencyContactAddress: data.emergencyContactAddress,
    additionalNotes: data.additionalNotes,
  };

  const profile = await prisma.applicantProfile.upsert({
    where: { userId },
    update: profileData,
    create: { userId, ...profileData },
  });
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

export const setAiConsentService = async (userId: string, consent: boolean) => {
  const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile not found");

  const updated = await prisma.applicantProfile.update({
    where: { id: profile.id },
    data: { hasConsentedToAi: consent },
  });
  return updated;
};
