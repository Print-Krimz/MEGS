import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import {
  updateScoringConfiguration,
  restoreDefaultScoringConfiguration,
  revalidateApplicantProfile,
  getScoringRevalidationStatus,
  waitForRevalidationQueueToIdle,
  getActiveScoringConfiguration,
} from "../services/scoring/scoring-configuration.service.js";
import { calculateAndPersistCandidateScore } from "../services/scoring/candidate-scoring.service.js";
import { updateSkillsService } from "../services/applicant/applicant.service.js";

describe("Score Reassessment Queue & End-to-End Reassessment Workflow", () => {
  let adminUser: any;
  let applicantUser: any;
  let applicantProfile: any;
  let taUser: any;
  let jobPosting: any;
  let application: any;

  beforeAll(async () => {
    const ts = Date.now();

    // 1. Create Admin
    adminUser = await prisma.user.create({
      data: {
        id: `admin-reval-${ts}`,
        email: `admin-reval-${ts}@example.com`,
        role: "ADMINISTRATOR",
      },
    });

    // 2. Create TA User
    taUser = await prisma.user.create({
      data: {
        id: `ta-reval-${ts}`,
        email: `ta-reval-${ts}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    // 3. Create Applicant User with profile
    applicantUser = await prisma.user.create({
      data: {
        id: `app-reval-${ts}`,
        email: `app-reval-${ts}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Carla",
            lastName: "Gomez",
            mobileNumber: "09171234567",
            gender: "FEMALE",
            province: "Metro Manila",
            city: "Taguig",
            dateOfBirth: new Date("1994-03-20"),
            birthPlace: "Taguig City",
            nationality: "Filipino",
            civilStatus: "SINGLE",
            address: "BGC, Taguig City",
            professionalSummary: "Backend Engineer with Express and PostgreSQL experience",
          },
        },
      },
      include: { applicantProfile: true },
    });
    applicantProfile = applicantUser.applicantProfile;

    // 4. Add initial work experience & skills
    await prisma.workExperience.create({
      data: {
        applicantProfileId: applicantProfile.id,
        company: "Tech Solutions Inc",
        roleTitle: "Software Developer",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2023-01-01"),
        summary: "Developed backend APIs using Node.js and Express",
      },
    });

    // 5. Create Job Posting
    jobPosting = await prisma.jobPosting.create({
      data: {
        title: "Senior Backend Developer",
        description: "Looking for an experienced Node.js and TypeScript developer",
        requirements: "Node.js, Express, TypeScript, PostgreSQL",
        location: "Taguig",
        status: "OPEN",
        postedById: taUser.id,
      },
    });

    // 6. Create Application
    application = await prisma.application.create({
      data: {
        jobPostingId: jobPosting.id,
        userId: applicantUser.id,
        status: "SUBMITTED",
      },
    });
  });

  afterAll(async () => {
    // Cleanup created data
    if (application) {
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: application.id } });
      await prisma.complianceRequirement.deleteMany({ where: { applicationId: application.id } });
      await prisma.clientEndorsement.deleteMany({ where: { applicationId: application.id } });
      await prisma.candidateScore.deleteMany({ where: { applicationId: application.id } });
      await prisma.scoringRevalidationTask.deleteMany({ where: { applicationId: application.id } });
      await prisma.application.deleteMany({ where: { id: application.id } });
    }
    if (jobPosting) {
      await prisma.candidateScore.deleteMany({ where: { jobPostingId: jobPosting.id } });
      await prisma.scoringRevalidationTask.deleteMany({ where: { jobPostingId: jobPosting.id } });
      await prisma.jobPosting.deleteMany({ where: { id: jobPosting.id } });
    }
    if (applicantProfile) {
      await prisma.candidateFeatureProfile.deleteMany({ where: { applicantProfileId: applicantProfile.id } });
      await prisma.scoringRevalidationTask.deleteMany({ where: { applicantProfileId: applicantProfile.id } });
      await prisma.workExperience.deleteMany({ where: { applicantProfileId: applicantProfile.id } });
      await prisma.applicantSkill.deleteMany({ where: { applicantProfileId: applicantProfile.id } });
      await prisma.applicantProfile.deleteMany({ where: { id: applicantProfile.id } });
    }
    if (applicantUser) {
      await prisma.notification.deleteMany({ where: { userId: applicantUser.id } });
      await prisma.user.deleteMany({ where: { id: applicantUser.id } });
    }
    if (taUser) {
      await prisma.notification.deleteMany({ where: { userId: taUser.id } });
      await prisma.user.deleteMany({ where: { id: taUser.id } });
    }
    if (adminUser) {
      await prisma.notification.deleteMany({ where: { userId: adminUser.id } });
      await prisma.candidateScoringConfiguration.updateMany({
        where: { createdById: adminUser.id },
        data: { createdById: null },
      });
      await prisma.candidateScoringConfiguration.updateMany({
        where: { activatedById: adminUser.id },
        data: { activatedById: null },
      });
      await prisma.user.deleteMany({ where: { id: adminUser.id } });
    }
  });

  it("calculates initial candidate match score and saves CandidateScore record", async () => {
    const initialScore = await calculateAndPersistCandidateScore(application.id, jobPosting.id, undefined, {
      forceNewCalculation: true,
    });

    expect(initialScore).toBeDefined();
    expect(initialScore.applicationId).toBe(application.id);
    expect(initialScore.finalFitScore).toBeGreaterThanOrEqual(0);
    expect(initialScore.finalFitScore).toBeLessThanOrEqual(100);

    const saved = await prisma.candidateScore.findFirst({
      where: { applicationId: application.id, status: "CALCULATED" },
    });
    expect(saved).not.toBeNull();
  }, 30000);

  it("queues reassessment tasks and updates scores when scoring weights are changed", async () => {
    const activeConfig = await getActiveScoringConfiguration();

    // Change weights emphasizing location and skills
    const newWeights = {
      SKILLS: 50,
      EXPERIENCE: 20,
      LOCATION: 20,
      COMPLIANCE: 5,
      EDUCATION_CERTIFICATIONS: 5,
    };

    const updatedConfig = await updateScoringConfiguration(adminUser.id, activeConfig.revision, {
      weights: newWeights,
      knnSettings: {
        defaultK: 10,
        maximumK: 50,
        minimumSimilarity: 0.5,
        excludeCurrentlyHired: true,
      },
      matchThreshold: 70,
    });

    expect(updatedConfig.version).toBeGreaterThan(activeConfig.version);

    // Wait for asynchronous reassessment queue to complete
    await waitForRevalidationQueueToIdle();

    // Verify task in database transitioned to COMPLETED
    const dedupeKey = `CONFIG-${updatedConfig.id}-APP-${application.id}`;
    const task = await prisma.scoringRevalidationTask.findUnique({
      where: { dedupeKey },
    });

    expect(task).not.toBeNull();
    expect(task?.status).toBe("COMPLETED");
    expect(task?.completedAt).not.toBeNull();
    expect(task?.configurationId).toBe(updatedConfig.id);

    // Verify new CandidateScore was calculated for the new configuration
    const newScore = await prisma.candidateScore.findFirst({
      where: {
        applicationId: application.id,
        configurationId: updatedConfig.id,
        status: "CALCULATED",
      },
    });
    expect(newScore).not.toBeNull();
    expect(Number(newScore?.finalFitScore)).toBeGreaterThanOrEqual(0);

    // Old scores for previous config should be marked STALE
    const oldScores = await prisma.candidateScore.findMany({
      where: {
        applicationId: application.id,
        configurationId: activeConfig.id,
      },
    });
    for (const oldScore of oldScores) {
      expect(oldScore.status).toBe("STALE");
    }
  }, 30000);

  it("triggers reassessment when candidate profile information is updated", async () => {
    const configBefore = await getActiveScoringConfiguration();

    // Update skills of candidate profile
    await updateSkillsService(applicantUser.id, ["TypeScript", "Express", "Node.js"]);

    // Wait for queue processing
    await waitForRevalidationQueueToIdle();

    // Verify APPLICANT_PROFILE revalidation task was completed
    const dedupeKey = `PROFILE-${applicantProfile.id}-APP-${application.id}-CONFIG-${configBefore.id}`;
    const task = await prisma.scoringRevalidationTask.findUnique({
      where: { dedupeKey },
    });

    expect(task).not.toBeNull();
    expect(task?.status).toBe("COMPLETED");
    expect(task?.target).toBe("APPLICANT_PROFILE");
  }, 30000);

  it("accurately returns queue status counts and failure logs from database", async () => {
    const activeConfig = await getActiveScoringConfiguration();

    // Deliberately create a failed task to test error display
    const failedTaskKey = `TEST-FAIL-${Date.now()}`;
    const failedTask = await prisma.scoringRevalidationTask.create({
      data: {
        target: "APPLICATION",
        applicationId: application.id,
        jobPostingId: jobPosting.id,
        configurationId: activeConfig.id,
        configurationVersion: activeConfig.version,
        dedupeKey: failedTaskKey,
        status: "FAILED",
        attempts: 3,
        lastError: "Connection timeout while fetching candidate vector embedding",
      },
    });

    const status = await getScoringRevalidationStatus();

    expect(status.counts).toBeDefined();
    expect(status.counts.COMPLETED).toBeGreaterThanOrEqual(1);
    expect(status.counts.FAILED).toBeGreaterThanOrEqual(1);

    const failureItem = status.failures.find((f) => f.id === failedTask.id.slice(0, 8));
    expect(failureItem).toBeDefined();
    expect(failureItem?.lastError).toContain("Connection timeout while fetching candidate vector embedding");
    expect(failureItem?.attempts).toBe(3);

    // Cleanup test failed task
    await prisma.scoringRevalidationTask.delete({ where: { id: failedTask.id } });
  });
});
