import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { updateTAApplicationStatus } from "../services/ta/ta.applications.service.js";
import { recordClientEndorsement } from "../services/ta/ta.endorsement.service.js";
import { createComplianceRequirement, reviewComplianceRequirement } from "../services/ta/ta.compliance.service.js";

describe("Canonical Hiring Pipeline & State Machine", () => {
  let testUser: any;
  let testJob: any;
  let testClient: any;
  let testMrf: any;
  let testTA: any;
  let testApp: any;

  beforeAll(async () => {
    // Create test TA user
    testTA = await prisma.user.create({
      data: {
        id: `ta-test-${Date.now()}`,
        email: `ta-${Date.now()}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    // Create candidate user
    testUser = await prisma.user.create({
      data: {
        id: `cand-test-${Date.now()}`,
        email: `candidate-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Test",
            lastName: "Candidate",
            mobileNumber: "09123456789",
            gender: "MALE",
            province: "Metro Manila",
            city: "Taguig",
            dateOfBirth: new Date("1995-01-01"),
            birthPlace: "Manila",
            nationality: "Filipino",
            civilStatus: "SINGLE",
            address: "123 Test St",
            professionalSummary: "Experienced backend developer",
          },
        },
      },
    });

    // Create client
    testClient = await prisma.client.create({
      data: {
        name: `Test Client ${Date.now()}`,
        industry: "IT",
      },
    });

    // Create MRF
    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        createdById: testTA.id,
        title: "Senior Node.js Developer",
        headcount: 2,
        requiredSkills: "Node.js, TypeScript, PostgreSQL",
      },
    });

    // Create Job Posting linked to MRF
    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "Senior Node.js Developer",
        description: "Full-time backend engineer",
        requirements: "Node.js, TypeScript, PostgreSQL",
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    // Clean up
    if (testApp?.id) {
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: testApp.id } });
      await prisma.complianceRequirement.deleteMany({ where: { applicationId: testApp.id } });
      await prisma.interview.deleteMany({ where: { applicationId: testApp.id } });
      await prisma.clientEndorsement.deleteMany({ where: { applicationId: testApp.id } });
      await prisma.deployment.deleteMany({ where: { applicationId: testApp.id } });
      await prisma.application.deleteMany({ where: { id: testApp.id } });
    }
    if (testJob?.id) await prisma.jobPosting.deleteMany({ where: { id: testJob.id } });
    if (testMrf?.id) {
      if ((prisma as any).mRFComplianceTemplate) {
        await (prisma as any).mRFComplianceTemplate.deleteMany({ where: { mrfId: testMrf.id } });
      } else if ((prisma as any).mrfComplianceTemplate) {
        await (prisma as any).mrfComplianceTemplate.deleteMany({ where: { mrfId: testMrf.id } });
      }
      await prisma.manpowerRequest.deleteMany({ where: { id: testMrf.id } });
    }
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
  });

  it("1. SUBMITTED → PARSING → REVIEW (Linear AI pipeline)", async () => {
    testApp = await prisma.application.create({
      data: {
        userId: testUser.id,
        jobPostingId: testJob.id,
        status: "SUBMITTED",
      },
    });

    const parsing = await updateTAApplicationStatus(testApp.id, "PARSING", testTA.id, "Resume parsing started");
    expect(parsing.status).toBe("PARSING");

    const review = await updateTAApplicationStatus(testApp.id, "REVIEW", testTA.id, "AI analysis completed");
    expect(review.status).toBe("REVIEW");
  });

  it("2. Blocks invalid stage skips (e.g. SUBMITTED/REVIEW → FINAL_INTERVIEW or HIRED)", async () => {
    await expect(
      updateTAApplicationStatus(testApp.id, "FINAL_INTERVIEW", testTA.id)
    ).rejects.toThrow(/Cannot move from REVIEW to FINAL_INTERVIEW/);

    await expect(
      updateTAApplicationStatus(testApp.id, "HIRED", testTA.id)
    ).rejects.toThrow(/Cannot move from REVIEW to HIRED/);
  });

  it("3. REVIEW → INITIAL_SCREENING (TA decides to screen candidate)", async () => {
    const screening = await updateTAApplicationStatus(testApp.id, "INITIAL_SCREENING", testTA.id, "Moving to initial interview");
    expect(screening.status).toBe("INITIAL_SCREENING");
  });

  it("4. Rejects INITIAL_SCREENING → CLIENT_ENDORSEMENT without a passed screening interview", async () => {
    await expect(
      updateTAApplicationStatus(testApp.id, "CLIENT_ENDORSEMENT", testTA.id)
    ).rejects.toThrow(/A passed INITIAL_SCREENING interview is required/);
  });

  it("5. Rejects INITIAL_SCREENING → CLIENT_ENDORSEMENT with a failed screening interview", async () => {
    const interview = await prisma.interview.create({
      data: {
        applicationId: testApp.id,
        type: "INITIAL_SCREENING",
        result: "FAIL",
        scheduledAt: new Date(),
      },
    });

    await expect(
      updateTAApplicationStatus(testApp.id, "CLIENT_ENDORSEMENT", testTA.id)
    ).rejects.toThrow(/A passed INITIAL_SCREENING interview is required/);

    // Update interview to PASS
    await prisma.interview.update({
      where: { id: interview.id },
      data: { result: "PASS" },
    });
  });

  it("6. Allows INITIAL_SCREENING → CLIENT_ENDORSEMENT when screening interview is passed", async () => {
    const endorsed = await updateTAApplicationStatus(testApp.id, "CLIENT_ENDORSEMENT", testTA.id, "Passed screening");
    expect(endorsed.status).toBe("CLIENT_ENDORSEMENT");
  });

  it("7. Rejects CLIENT_ENDORSEMENT → FINAL_INTERVIEW without client endorsement", async () => {
    await expect(
      updateTAApplicationStatus(testApp.id, "FINAL_INTERVIEW", testTA.id)
    ).rejects.toThrow(/Client endorsement.*required/);
  });

  it("8. Rejects CLIENT_ENDORSEMENT → FINAL_INTERVIEW when client declines candidate", async () => {
    const endorsement = await recordClientEndorsement(testApp.id, testClient.id, "DECLINED", testTA.id, "Over budget");
    expect(endorsement.outcome).toBe("DECLINED");

    await expect(
      updateTAApplicationStatus(testApp.id, "FINAL_INTERVIEW", testTA.id)
    ).rejects.toThrow(/Client endorsement.*required/);

    // Record positive endorsement
    await recordClientEndorsement(testApp.id, testClient.id, "ENDORSED", testTA.id, "Client approved profile");
  });

  it("9. Allows CLIENT_ENDORSEMENT → FINAL_INTERVIEW when candidate is endorsed", async () => {
    const finalStage = await updateTAApplicationStatus(testApp.id, "FINAL_INTERVIEW", testTA.id, "Client approved");
    expect(finalStage.status).toBe("FINAL_INTERVIEW");
  });

  it("10. Rejects FINAL_INTERVIEW → HIRED without a passed final interview", async () => {
    await expect(
      updateTAApplicationStatus(testApp.id, "HIRED", testTA.id)
    ).rejects.toThrow(/A passed FINAL_INTERVIEW is required/);
  });

  it("11. Allows FINAL_INTERVIEW → HIRED when final interview is passed", async () => {
    await prisma.interview.create({
      data: {
        applicationId: testApp.id,
        type: "FINAL_INTERVIEW",
        result: "PASS",
        scheduledAt: new Date(),
      },
    });

    const hired = await updateTAApplicationStatus(testApp.id, "HIRED", testTA.id, "Job offer accepted");
    expect(hired.status).toBe("HIRED");
  });

  it("12. HIRED → COMPLIANCE transition", async () => {
    const compliance = await updateTAApplicationStatus(testApp.id, "COMPLIANCE", testTA.id, "Collecting requirements");
    expect(compliance.status).toBe("COMPLIANCE");
  });

  it("13. Rejects COMPLIANCE → DEPLOYED if mandatory compliance requirement is PENDING", async () => {
    const req = await createComplianceRequirement(testApp.id, "NBI Clearance", true);
    expect(req.reviewStatus).toBe("PENDING");

    await expect(
      updateTAApplicationStatus(testApp.id, "DEPLOYED", testTA.id)
    ).rejects.toThrow(/compliance/i);
  });

  it("14. Rejects COMPLIANCE → DEPLOYED if mandatory compliance requirement is REJECTED", async () => {
    const reqs = await prisma.complianceRequirement.findMany({ where: { applicationId: testApp.id } });
    await reviewComplianceRequirement(reqs[0].id, testTA.id, "REJECTED", "Blurry image");

    await expect(
      updateTAApplicationStatus(testApp.id, "DEPLOYED", testTA.id)
    ).rejects.toThrow(/compliance/i);
  });

  it("15. Rejects COMPLIANCE → DEPLOYED if mandatory compliance requirement is EXPIRED", async () => {
    const reqs = await prisma.complianceRequirement.findMany({ where: { applicationId: testApp.id } });
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 5);

    await prisma.complianceRequirement.update({
      where: { id: reqs[0].id },
      data: {
        reviewStatus: "APPROVED",
        expiresAt: expiredDate,
      },
    });

    await expect(
      updateTAApplicationStatus(testApp.id, "DEPLOYED", testTA.id)
    ).rejects.toThrow(/compliance/i);
  });

  it("16. Allows COMPLIANCE → DEPLOYED when all mandatory requirements are APPROVED and unexpired", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 365);

    await prisma.complianceRequirement.updateMany({
      where: { applicationId: testApp.id },
      data: {
        reviewStatus: "APPROVED",
        expiresAt: futureDate,
      },
    });

    const deployed = await updateTAApplicationStatus(testApp.id, "DEPLOYED", testTA.id, "Deployed to client site");
    expect(deployed.status).toBe("DEPLOYED");
  });

  it("17. Verify complete audit trail was recorded for all transitions", async () => {
    const decisions = await prisma.recruiterDecision.findMany({
      where: { applicationId: testApp.id },
      orderBy: { createdAt: "asc" },
    });

    expect(decisions.length).toBeGreaterThanOrEqual(7);
    const toStatuses = decisions.map(d => d.toStatus);
    expect(toStatuses).toContain("PARSING");
    expect(toStatuses).toContain("REVIEW");
    expect(toStatuses).toContain("INITIAL_SCREENING");
    expect(toStatuses).toContain("CLIENT_ENDORSEMENT");
    expect(toStatuses).toContain("FINAL_INTERVIEW");
    expect(toStatuses).toContain("HIRED");
    expect(toStatuses).toContain("COMPLIANCE");
    expect(toStatuses).toContain("DEPLOYED");
  });
});
