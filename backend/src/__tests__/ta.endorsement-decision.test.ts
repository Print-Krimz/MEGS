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

  it("creates a PENDING endorsement and updates client decision to ENDORSED", async () => {
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

    const endorsement = await recordClientEndorsement(
      testApp.id,
      testClient.id,
      "PENDING",
      testTA.id,
      "Candidate submitted to client for technical review"
    );

    expect(endorsement.outcome).toBe("PENDING");

    // Cannot advance to FINAL_INTERVIEW while outcome is PENDING
    await expect(
      updateTAApplicationStatus(testApp.id, "FINAL_INTERVIEW", testTA.id)
    ).rejects.toThrow(/Client endorsement.*required/);

    // Update endorsement decision to ENDORSED
    const updatedEndorsement = await updateClientEndorsement(
      testApp.id,
      endorsement.id,
      "ENDORSED",
      testTA.id,
      "Client reviewed and approved candidate for final interview"
    );

    expect(updatedEndorsement.outcome).toBe("ENDORSED");

    // Now candidate can advance to FINAL_INTERVIEW
    const advanced = await updateTAApplicationStatus(
      testApp.id,
      "FINAL_INTERVIEW",
      testTA.id,
      "Client approved candidate"
    );
    expect(advanced.status).toBe("FINAL_INTERVIEW");
  });
});
