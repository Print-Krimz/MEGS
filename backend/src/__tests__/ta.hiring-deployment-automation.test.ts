import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { executeHiring } from "../services/ta/ta.posthire.service.js";
import { createComplianceRequirement, reviewComplianceRequirement } from "../services/ta/ta.compliance.service.js";
import { createDeployment } from "../services/ta/ta.deployments.service.js";

describe("Phase 4 & 5: Hiring & Deployment Automation", () => {
  let testTA: any;
  let testUser: any;
  let testClient: any;
  let testMrf: any;
  let testJob: any;
  let testApp: any;

  beforeAll(async () => {
    testTA = await prisma.user.create({
      data: {
        id: `ta-p45-${Date.now()}`,
        email: `ta-p45-${Date.now()}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    testUser = await prisma.user.create({
      data: {
        id: `cand-p45-${Date.now()}`,
        email: `cand-p45-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Deployment",
            lastName: "Candidate",
            mobileNumber: "09444444444",
          },
        },
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Mega Corp ${Date.now()}`,
      },
    });

    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        createdById: testTA.id,
        title: "Site Supervisor",
        location: "Clark Freezone Pampanga",
      },
    });

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "Site Supervisor",
        description: "Supervisor description",
        requirements: "Logistics, Supervision",
        location: "Clark Pampanga",
        status: "OPEN",
      },
    });

    testApp = await prisma.application.create({
      data: {
        userId: testUser.id,
        jobPostingId: testJob.id,
        status: "FINAL_INTERVIEW",
      },
    });

    // Final interview pass
    await prisma.interview.create({
      data: {
        applicationId: testApp.id,
        type: "FINAL_INTERVIEW",
        result: "PASS",
        scheduledAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    try {
      if (testApp?.id) {
        await prisma.deploymentStatusHistory.deleteMany({ where: { deployment: { applicationId: testApp.id } } });
        await prisma.deployment.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.complianceRequirement.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.employmentEvent.deleteMany({ where: { employee: { userId: testUser.id } } });
        await prisma.employee.deleteMany({ where: { userId: testUser.id } });
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

  it("Phase 4: automatically pre-fills department and position from Job/MRF when completing hire", async () => {
    const { employee, application } = await executeHiring(
      testApp.id,
      { reason: "Candidate passed all stages" },
      testTA.id
    );

    expect(application.status).toBe("HIRED");
    expect(employee.position).toBe("Site Supervisor");
    expect(employee.employeeNumber).toBeDefined();
    expect(employee.status).toBe("ACTIVE");
  });

  it("Phase 5: blocks deployment if mandatory compliance is unapproved, and automatically pre-fills deployment site from MRF on approval", async () => {
    // Add mandatory compliance requirement
    const req = await createComplianceRequirement(testApp.id, "Pre-Employment Medical", true);

    // Deployment should fail because requirement is PENDING
    await expect(
      createDeployment(testTA.id, {
        applicationId: testApp.id,
        clientId: testClient.id,
      })
    ).rejects.toThrow(/All required compliance documents must be APPROVED/);

    // Approve all requirements
    const pendingReqs = await prisma.complianceRequirement.findMany({ where: { applicationId: testApp.id } });
    for (const r of pendingReqs) {
      await reviewComplianceRequirement(r.id, testTA.id, "APPROVED", "Verified authentic");
    }

    // Now deployment succeeds with automatic MRF site derivation
    const deployment = await createDeployment(testTA.id, {
      applicationId: testApp.id,
      clientId: testClient.id,
    });

    expect(deployment.status).toBe("READY_FOR_DEPLOYMENT");
    expect(deployment.site).toBe("Clark Freezone Pampanga");
    expect(deployment.mrfId).toBe(testMrf.id);

    const updatedApp = await prisma.application.findUnique({ where: { id: testApp.id } });
    expect(updatedApp?.status).toBe("DEPLOYED");
  });
});
