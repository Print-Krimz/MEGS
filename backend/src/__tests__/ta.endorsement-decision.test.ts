import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { recordClientEndorsement, updateClientEndorsement } from "../services/ta/ta.endorsement.service.js";
import { updateTAApplicationStatus } from "../services/ta/ta.applications.service.js";

describe("Phase 2: Client Endorsement & Decision Workflow", () => {
  let testTA: any;
  let testUser: any;
  let testClient: any;
  let testMrf: any;
  let testJob: any;
  let testApp: any;

  beforeAll(async () => {
    testTA = await prisma.user.create({
      data: {
        id: `ta-p2-${Date.now()}`,
        email: `ta-p2-${Date.now()}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    testUser = await prisma.user.create({
      data: {
        id: `cand-p2-${Date.now()}`,
        email: `cand-p2-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Endorsement",
            lastName: "Candidate",
            mobileNumber: "09222222222",
          },
        },
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Acme Corp ${Date.now()}`,
      },
    });

    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        createdById: testTA.id,
        title: "Fullstack Engineer",
      },
    });

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "Fullstack Engineer",
        description: "Fullstack description",
        requirements: "React, Node.js",
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    try {
      if (testApp?.id) {
        await prisma.clientEndorsement.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.interview.deleteMany({ where: { applicationId: testApp.id } });
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

  it("creates a PENDING endorsement and updates client decision to APPROVED", async () => {
    testApp = await prisma.application.create({
      data: {
        userId: testUser.id,
        jobPostingId: testJob.id,
        status: "INITIAL_SCREENING",
      },
    });

    // Create Initial Screening PASS
    await prisma.interview.create({
      data: {
        applicationId: testApp.id,
        type: "INITIAL_SCREENING",
        result: "PASS",
        scheduledAt: new Date(),
      },
    });

    // Auto-derives client from JobPosting -> MRF -> Client
    const endorsement = await recordClientEndorsement(
      testApp.id,
      undefined,
      "PENDING",
      testTA.id,
      "Candidate submitted to client for technical review"
    );

    expect(endorsement.outcome).toBe("PENDING");
    expect(endorsement.clientId).toBe(testClient.id);

    // Cannot advance to FINAL_INTERVIEW while outcome is PENDING
    await expect(
      updateTAApplicationStatus(testApp.id, "FINAL_INTERVIEW", testTA.id)
    ).rejects.toThrow(/Client endorsement approval \(outcome: APPROVED\) is required/);

    // Update endorsement decision to APPROVED
    const updatedEndorsement = await updateClientEndorsement(
      testApp.id,
      endorsement.id,
      "APPROVED",
      testTA.id,
      "Client reviewed and accepted candidate for final interview"
    );

    expect(updatedEndorsement.outcome).toBe("APPROVED");

    // Candidate has automatically transitioned to FINAL_INTERVIEW
    const currentApp = await prisma.application.findUnique({ where: { id: testApp.id } });
    expect(currentApp?.status).toBe("FINAL_INTERVIEW");
  }, 25000);

  it("blocks advancement to FINAL_INTERVIEW when client decision is DECLINED", async () => {
    const declinedUser = await prisma.user.create({
      data: {
        id: `declined-user-${Date.now()}`,
        email: `declined-${Date.now()}@example.com`,
        role: "APPLICANT",
      },
    });

    const declinedApp = await prisma.application.create({
      data: {
        userId: declinedUser.id,
        jobPostingId: testJob.id,
        status: "INITIAL_SCREENING",
      },
    });

    await prisma.interview.create({
      data: {
        applicationId: declinedApp.id,
        type: "INITIAL_SCREENING",
        result: "PASS",
        scheduledAt: new Date(),
      },
    });

    const endorsement = await recordClientEndorsement(
      declinedApp.id,
      undefined,
      "DECLINED",
      testTA.id,
      "Client rejected candidate profile"
    );

    expect(endorsement.outcome).toBe("DECLINED");

    await expect(
      updateTAApplicationStatus(declinedApp.id, "FINAL_INTERVIEW", testTA.id)
    ).rejects.toThrow(/Client endorsement approval \(outcome: APPROVED\) is required/);

    // Cleanup
    await prisma.notification.deleteMany({ where: { userId: declinedUser.id } });
    await prisma.clientEndorsement.deleteMany({ where: { applicationId: declinedApp.id } });
    await prisma.recruiterDecision.deleteMany({ where: { applicationId: declinedApp.id } });
    await prisma.interview.deleteMany({ where: { applicationId: declinedApp.id } });
    await prisma.application.delete({ where: { id: declinedApp.id } });
    await prisma.user.delete({ where: { id: declinedUser.id } });
  }, 25000);

  it("rejects endorsement if application is missing a linked MRF or Client relationship", async () => {
    const unlinkedUser = await prisma.user.create({
      data: {
        id: `unlinked-user-${Date.now()}`,
        email: `unlinked-${Date.now()}@example.com`,
        role: "APPLICANT",
      },
    });

    const unlinkedJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        title: "Unlinked Job",
        description: "No MRF linked",
        requirements: "General",
        status: "OPEN",
      },
    });

    const unlinkedApp = await prisma.application.create({
      data: {
        userId: unlinkedUser.id,
        jobPostingId: unlinkedJob.id,
        status: "INITIAL_SCREENING",
      },
    });

    await prisma.interview.create({
      data: {
        applicationId: unlinkedApp.id,
        type: "INITIAL_SCREENING",
        result: "PASS",
        scheduledAt: new Date(),
      },
    });

    await expect(
      recordClientEndorsement(unlinkedApp.id, undefined, "PENDING", testTA.id)
    ).rejects.toThrow(/Application requisition is missing a linked Job Posting, MRF, or Client relationship/);

    // Cleanup
    await prisma.notification.deleteMany({ where: { userId: unlinkedUser.id } });
    await prisma.interview.deleteMany({ where: { applicationId: unlinkedApp.id } });
    await prisma.application.delete({ where: { id: unlinkedApp.id } });
    await prisma.jobPosting.delete({ where: { id: unlinkedJob.id } });
    await prisma.user.delete({ where: { id: unlinkedUser.id } });
  }, 25000);
});
