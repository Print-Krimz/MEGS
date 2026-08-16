import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../../utils/prisma.js";
import { upsertApplicantProfile, getApplicantProfile } from "./applicant.service.js";

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
    await prisma.applicantProfile.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
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
});
