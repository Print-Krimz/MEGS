import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../../utils/prisma.js";
import {
  upsertApplicantProfile,
  getApplicantProfile,
  updateProfilePhotoService,
} from "./applicant.service.js";

describe("Applicant Profile Service - Incremental & Partial Upsert", () => {
  const testUserId = `test-applicant-upsert-${Date.now()}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        role: "APPLICANT",
      },
    });
  });

  afterAll(async () => {
    try {
      const profile = await prisma.applicantProfile.findUnique({ where: { userId: testUserId } });
      if (profile) {
        await prisma.scoringRevalidationTask.deleteMany({ where: { applicantProfileId: profile.id } });
        await prisma.candidateFeatureProfile.deleteMany({ where: { applicantProfileId: profile.id } });
        await prisma.talentPoolMembership.deleteMany({ where: { applicantProfileId: profile.id } });
        await prisma.education.deleteMany({ where: { applicantProfileId: profile.id } });
        await prisma.workExperience.deleteMany({ where: { applicantProfileId: profile.id } });
        await prisma.applicantSkill.deleteMany({ where: { applicantProfileId: profile.id } });
        await prisma.trainingCertification.deleteMany({ where: { applicantProfileId: profile.id } });
        await prisma.asset.deleteMany({ where: { applicantProfileId: profile.id } });
        await prisma.characterReference.deleteMany({ where: { applicantProfileId: profile.id } });
        await prisma.applicantProfile.deleteMany({ where: { id: profile.id } });
      }
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch (e) {
      console.warn("Teardown error:", e);
    }
  });

  it("successfully creates a profile when optional fields (gender, birthPlace, etc.) are omitted/undefined", async () => {
    const partialData = {
      firstName: "Nathaniel",
      middleName: "T.",
      lastName: "Cruz",
      mobileNumber: "12345678910",
      province: "Metro Manila",
      city: "Quezon City",
      dateOfBirth: "2008-06-16",
      address: "1 Bako Street",
      emergencyContactName: "Wala",
      emergencyContactRelationship: "Parent",
      emergencyContactPhone: "123",
      // gender, birthPlace, nationality, civilStatus, professionalSummary are undefined
    };

    const profile = await upsertApplicantProfile(testUserId, partialData);

    expect(profile).toBeDefined();
    expect(profile.id).toBeDefined();
    expect(profile.firstName).toBe("Nathaniel");
    expect(profile.lastName).toBe("Cruz");
    expect(profile.gender).toBeNull();
    expect(profile.birthPlace).toBeNull();
    expect(profile.nationality).toBeNull();
  });

  it("successfully updates an existing profile without overwriting unspecified fields", async () => {
    const updateData = {
      gender: "Male",
      civilStatus: "Single",
    };

    const updated = await upsertApplicantProfile(testUserId, updateData);

    expect(updated.gender).toBe("Male");
    expect(updated.civilStatus).toBe("Single");
    expect(updated.firstName).toBe("Nathaniel");
    expect(updated.lastName).toBe("Cruz");
  });

  it("updates photoUrl and retrieves profile with resolved photoUrl", async () => {
    const photoUrl = "/api/documents/99999/download";
    const updated = await updateProfilePhotoService(testUserId, photoUrl);
    expect(updated.photoUrl).toBeDefined();

    const fetched = await getApplicantProfile(testUserId);
    expect(fetched).toBeDefined();
    expect(fetched?.photoUrl).toBeDefined();
  });

  it("ensureApplicantProfile is idempotent and never creates duplicate profile rows", async () => {
    const freshUserId = `test-fresh-applicant-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: freshUserId,
        email: `${freshUserId}@example.com`,
        role: "APPLICANT",
      },
    });

    try {
      const { ensureApplicantProfile, addWorkExperienceService } = await import("./applicant.service.js");
      const profile1 = await ensureApplicantProfile(freshUserId);
      const profile2 = await ensureApplicantProfile(freshUserId);

      expect(profile1.id).toBe(profile2.id);

      const allProfiles = await prisma.applicantProfile.findMany({ where: { userId: freshUserId } });
      expect(allProfiles.length).toBe(1);

      // Child creation works directly on un-configured profile
      const exp = await addWorkExperienceService(freshUserId, {
        company: "Acme Logistics",
        roleTitle: "Inventory Specialist",
        startDate: "2023-01-01",
        isCurrent: true,
      });

      expect(exp.id).toBeDefined();
      expect(exp.applicantProfileId).toBe(profile1.id);
    } finally {
      const p = await prisma.applicantProfile.findUnique({ where: { userId: freshUserId } });
      if (p) {
        await prisma.scoringRevalidationTask.deleteMany({ where: { applicantProfileId: p.id } });
        await prisma.workExperience.deleteMany({ where: { applicantProfileId: p.id } });
        await prisma.applicantProfile.deleteMany({ where: { id: p.id } });
      }
      await prisma.user.deleteMany({ where: { id: freshUserId } });
    }
  });
});
