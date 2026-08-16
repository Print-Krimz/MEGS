import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { updateTAApplicationStatus, ALLOWED_TRANSITIONS } from "../services/ta/ta.applications.service.js";

describe("Phase 1: Workflow State Machine & Candidate Rejection", () => {
  let testTA: any;
  let testUser: any;
  let testClient: any;
  let testMrf: any;
  let testJob: any;
  let testApp: any;

  beforeAll(async () => {
    testTA = await prisma.user.create({
      data: {
        id: `ta-p1-${Date.now()}`,
        email: `ta-p1-${Date.now()}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    testUser = await prisma.user.create({
      data: {
        id: `cand-p1-${Date.now()}`,
        email: `cand-p1-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Phase1",
            lastName: "Candidate",
            mobileNumber: "09111111111",
          },
        },
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Phase1 Client ${Date.now()}`,
      },
    });

    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        createdById: testTA.id,
        title: "QA Engineer",
      },
    });

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "QA Engineer",
        description: "QA description",
        requirements: "Playwright, Vitest",
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    try {
      if (testApp?.id) {
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.application.deleteMany({ where: { id: testApp.id } });
      }
      if (testJob?.id) await prisma.jobPosting.deleteMany({ where: { id: testJob.id } });
      if (testMrf?.id) await prisma.manpowerRequest.deleteMany({ where: { id: testMrf.id } });
      if (testClient?.id) await prisma.client.deleteMany({ where: { id: testClient.id } });
      if (testUser?.id) {
        await prisma.notification.deleteMany({ where: { userId: testUser.id } });
        await prisma.applicantProfile.deleteMany({ where: { userId: testUser.id } });
        await prisma.user.deleteMany({ where: { id: testUser.id } });
      }
      if (testTA?.id) {
        await prisma.notification.deleteMany({ where: { userId: testTA.id } });
        await prisma.user.deleteMany({ where: { id: testTA.id } });
      }
    } catch {
      // Best-effort cleanup
    }
  });

  it("allows rejecting (ARCHIVED) from active stages with audit reason", async () => {
    testApp = await prisma.application.create({
      data: {
        userId: testUser.id,
        jobPostingId: testJob.id,
        status: "INITIAL_SCREENING",
      },
    });

    const rejected = await updateTAApplicationStatus(
      testApp.id,
      "ARCHIVED",
      testTA.id,
      "Candidate did not meet technical bar during screening"
    );

    expect(rejected.status).toBe("ARCHIVED");

    // Verify audit log
    const decision = await prisma.recruiterDecision.findFirst({
      where: { applicationId: testApp.id, toStatus: "ARCHIVED" },
    });
    expect(decision).toBeDefined();
    expect(decision?.fromStatus).toBe("INITIAL_SCREENING");
    expect(decision?.reason).toContain("Candidate did not meet technical bar");
  });

  it("verifies ALLOWED_TRANSITIONS contains ARCHIVED for all active non-terminal states", () => {
    const activeStates = [
      "SUBMITTED",
      "PARSING",
      "REVIEW",
      "NEEDS_ATTENTION",
      "MATCHED",
      "TALENT_POOL",
      "INITIAL_SCREENING",
      "CLIENT_ENDORSEMENT",
      "FINAL_INTERVIEW",
      "HIRED",
      "COMPLIANCE",
      "DEPLOYED",
    ];

    for (const state of activeStates) {
      expect(ALLOWED_TRANSITIONS[state]).toContain("ARCHIVED");
    }
  });
});
