import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { fastTrackRedeployment } from "../services/ta/ta.deployments.service.js";
import { fastTrackRedeploymentHandler } from "../controllers/ta/ta.deployments.controller.js";

describe("TA Redeployment Fast-Track & 12-Month Clearance Carryover", () => {
  const ts = Date.now();
  let testTA: any;
  let clientA: any;
  let clientB: any;
  let mrfA: any;
  let jobA: any;
  let jobA2: any;
  let mrfB: any;
  let jobB: any;

  // Candidate with NO prior employment/deployment
  let freshUser: any;
  let freshApp: any;

  // Candidate with Employee record but NO deployments and ACTIVE status (ineligible)
  let noDeployUser: any;
  let noDeployEmployee: any;
  let noDeployApp: any;

  // Eligible Candidate with past deployments and valid/expired documents
  let returningUser: any;
  let returningEmployee: any;
  let pastAppA: any;
  let newAppA: any;
  let newAppB: any;

  beforeAll(async () => {
    // 1. Recruiter user
    testTA = await prisma.user.create({
      data: {
        id: `ta-ft-${ts}`,
        email: `ta-ft-${ts}@test.com`,
        role: "TALENT_ACQUISITION",
        isActive: true,
      },
    });

    // 2. Clients
    clientA = await prisma.client.create({
      data: {
        name: `FastTrack Client A ${ts}`,
        industry: "Manufacturing",
        isActive: true,
      },
    });

    clientB = await prisma.client.create({
      data: {
        name: `FastTrack Client B ${ts}`,
        industry: "Retail",
        isActive: true,
      },
    });

    // 3. MRFs and Job Postings
    mrfA = await prisma.manpowerRequest.create({
      data: {
        clientId: clientA.id,
        title: `MRF Alpha ${ts}`,
        createdById: testTA.id,
        status: "OPEN",
      },
    });

    jobA = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: mrfA.id,
        title: `Assembler Alpha ${ts}`,
        description: "Assembly work",
        requirements: "High school grad",
        status: "OPEN",
      },
    });

    jobA2 = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: mrfA.id,
        title: `Senior Assembler Alpha ${ts}`,
        description: "Assembly work 2",
        requirements: "High school grad",
        status: "OPEN",
      },
    });

    mrfB = await prisma.manpowerRequest.create({
      data: {
        clientId: clientB.id,
        title: `MRF Beta ${ts}`,
        createdById: testTA.id,
        status: "OPEN",
      },
    });

    jobB = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: mrfB.id,
        title: `Cashier Beta ${ts}`,
        description: "Cashiering work",
        requirements: "Customer service",
        status: "OPEN",
      },
    });

    // 4. Candidate with NO employment history
    freshUser = await prisma.user.create({
      data: {
        id: `fresh-user-${ts}`,
        email: `fresh-${ts}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Fresh",
            lastName: "Candidate",
          },
        },
      },
    });

    freshApp = await prisma.application.create({
      data: {
        userId: freshUser.id,
        jobPostingId: jobA.id,
        status: "SUBMITTED",
      },
    });

    // 5. Candidate with Employee record but 0 deployments and not AVAILABLE_FOR_REDEPLOYMENT
    noDeployUser = await prisma.user.create({
      data: {
        id: `nodeploy-user-${ts}`,
        email: `nodeploy-${ts}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "NoDeploy",
            lastName: "Candidate",
          },
        },
      },
    });

    noDeployEmployee = await prisma.employee.create({
      data: {
        userId: noDeployUser.id,
        employeeNumber: `EMP-ND-${ts.toString().slice(-4)}`,
        status: "ACTIVE",
      },
    });

    noDeployApp = await prisma.application.create({
      data: {
        userId: noDeployUser.id,
        jobPostingId: jobA.id,
        status: "INITIAL_SCREENING",
      },
    });

    // 6. Returning candidate with prior deployment history
    returningUser = await prisma.user.create({
      data: {
        id: `returning-user-${ts}`,
        email: `returning-${ts}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Juan",
            lastName: "Dela Cruz",
          },
        },
      },
    });

    returningEmployee = await prisma.employee.create({
      data: {
        userId: returningUser.id,
        employeeNumber: `EMP-RET-${ts.toString().slice(-4)}`,
        status: "AVAILABLE_FOR_REDEPLOYMENT",
      },
    });

    // Prior application on Client A
    pastAppA = await prisma.application.create({
      data: {
        userId: returningUser.id,
        jobPostingId: jobA.id,
        status: "DEPLOYED",
      },
    });

    // Prior deployment record linking returningEmployee to Client A
    await prisma.deployment.create({
      data: {
        employeeId: returningEmployee.id,
        applicationId: pastAppA.id,
        clientId: clientA.id,
        site: "Plant 1",
        status: "ENDED",
        contractStart: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        contractEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        createdById: testTA.id,
      },
    });

    // Seed prior compliance documents on pastAppA
    const now = new Date();
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const fourteenMonthsAgo = new Date(now.getTime() - 420 * 24 * 60 * 60 * 1000);
    const futureExpiry = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const pastExpiry = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    // Doc 1: Valid NBI Clearance (General clearance, unexpired, within 12 months) -> MUST CARRY OVER
    await prisma.complianceRequirement.create({
      data: {
        applicationId: pastAppA.id,
        documentLabel: "NBI Clearance",
        documentId: 501,
        reviewStatus: "APPROVED",
        reviewedById: testTA.id,
        reviewedAt: twoMonthsAgo,
        expiresAt: futureExpiry,
      },
    });

    // Doc 2: Valid SSS Document (General clearance, null expiresAt, within 12 months) -> MUST CARRY OVER
    await prisma.complianceRequirement.create({
      data: {
        applicationId: pastAppA.id,
        documentLabel: "SSS Document",
        documentId: 502,
        reviewStatus: "APPROVED",
        reviewedById: testTA.id,
        reviewedAt: sixMonthsAgo,
        expiresAt: null,
      },
    });

    // Doc 3: Expired ReviewedAt (> 12 months / 365 days ago) -> MUST NOT CARRY OVER
    await prisma.complianceRequirement.create({
      data: {
        applicationId: pastAppA.id,
        documentLabel: "PhilHealth Member Data Record",
        documentId: 503,
        reviewStatus: "APPROVED",
        reviewedById: testTA.id,
        reviewedAt: fourteenMonthsAgo,
        expiresAt: futureExpiry,
      },
    });

    // Doc 4: Expired document date (expiresAt < now) -> MUST NOT CARRY OVER
    await prisma.complianceRequirement.create({
      data: {
        applicationId: pastAppA.id,
        documentLabel: "Fit to Work Medical Exam",
        documentId: 504,
        reviewStatus: "APPROVED",
        reviewedById: testTA.id,
        reviewedAt: twoMonthsAgo,
        expiresAt: pastExpiry,
      },
    });

    // Doc 5: Rejected document -> MUST NOT CARRY OVER
    await prisma.complianceRequirement.create({
      data: {
        applicationId: pastAppA.id,
        documentLabel: "Police Clearance",
        documentId: 505,
        reviewStatus: "REJECTED",
        reviewedById: testTA.id,
        reviewedAt: twoMonthsAgo,
        expiresAt: futureExpiry,
      },
    });

    // Doc 6: Client A specific document (Client NDA) -> Valid on Client A, excluded on Client B
    await prisma.complianceRequirement.create({
      data: {
        applicationId: pastAppA.id,
        documentLabel: "Client NDA & Security Briefing",
        documentId: 506,
        reviewStatus: "APPROVED",
        reviewedById: testTA.id,
        reviewedAt: twoMonthsAgo,
        expiresAt: futureExpiry,
      },
    });

    // New active application for returning user on Client A (same client)
    newAppA = await prisma.application.create({
      data: {
        userId: returningUser.id,
        jobPostingId: jobA2.id,
        status: "SUBMITTED",
      },
    });

    // Another new active application on Client B (different client)
    newAppB = await prisma.application.create({
      data: {
        userId: returningUser.id,
        jobPostingId: jobB.id,
        status: "REVIEW",
      },
    });
  }, 35000);

  afterAll(async () => {
    try {
      const appIds = [freshApp?.id, noDeployApp?.id, pastAppA?.id, newAppA?.id, newAppB?.id].filter(Boolean);
      const userIds = [freshUser?.id, noDeployUser?.id, returningUser?.id, testTA?.id].filter(Boolean);
      const empIds = [noDeployEmployee?.id, returningEmployee?.id].filter(Boolean);
      const jobIds = [jobA?.id, jobA2?.id, jobB?.id].filter(Boolean);
      const mrfIds = [mrfA?.id, mrfB?.id].filter(Boolean);
      const clientIds = [clientA?.id, clientB?.id].filter(Boolean);

      if (appIds.length > 0) {
        await prisma.deploymentStatusHistory.deleteMany({ where: { deployment: { applicationId: { in: appIds } } } });
        await prisma.deployment.deleteMany({ where: { applicationId: { in: appIds } } });
        await prisma.complianceRequirement.deleteMany({ where: { applicationId: { in: appIds } } });
        await prisma.clientEndorsement.deleteMany({ where: { applicationId: { in: appIds } } });
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: { in: appIds } } });
        await prisma.interview.deleteMany({ where: { applicationId: { in: appIds } } });
        await prisma.application.deleteMany({ where: { id: { in: appIds } } });
      }

      if (empIds.length > 0) {
        await prisma.employmentEvent.deleteMany({ where: { employeeId: { in: empIds } } });
        await prisma.deployment.deleteMany({ where: { employeeId: { in: empIds } } });
        await prisma.employee.deleteMany({ where: { id: { in: empIds } } });
      }

      if (jobIds.length > 0) await prisma.jobPosting.deleteMany({ where: { id: { in: jobIds } } });
      if (mrfIds.length > 0) await prisma.manpowerRequest.deleteMany({ where: { id: { in: mrfIds } } });
      if (clientIds.length > 0) await prisma.client.deleteMany({ where: { id: { in: clientIds } } });

      if (userIds.length > 0) {
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.applicantProfile.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } catch {
      // Best-effort cleanup
    }
  }, 35000);

  it("1. Rejects fast-track if candidate has no prior employment/deployment history", async () => {
    await expect(
      fastTrackRedeployment(freshApp.id, testTA.id)
    ).rejects.toThrow(/Candidate is not eligible for redeployment fast-track/i);
  });

  it("2. Rejects fast-track if candidate has Employee record but 0 deployments and status is not AVAILABLE_FOR_REDEPLOYMENT", async () => {
    await expect(
      fastTrackRedeployment(noDeployApp.id, testTA.id)
    ).rejects.toThrow(/Prior deployment history or AVAILABLE_FOR_REDEPLOYMENT status is required/i);
  });

  it("3. Successfully fast-tracks eligible candidate to COMPLIANCE and carries over 12-month unexpired approved clearances", async () => {
    const result = await fastTrackRedeployment(newAppA.id, testTA.id, { targetStage: "COMPLIANCE" });

    expect(result.success).toBe(true);
    expect(result.application.status).toBe("COMPLIANCE");

    // Check carried over documents:
    // Expected carried over:
    // - "NBI Clearance" (Doc 1: approved, < 12 mo, unexpired)
    // - "SSS Document" (Doc 2: approved, < 12 mo, null expiry)
    // - "Client NDA & Security Briefing" (Doc 6: approved, < 12 mo, same client A)
    // Excluded:
    // - PhilHealth (Doc 3: > 12 months)
    // - Fit to Work (Doc 4: expired date)
    // - Police Clearance (Doc 5: rejected)
    const carriedLabels = result.carriedOverDocuments.map((d: any) => d.documentLabel);
    expect(carriedLabels).toContain("NBI Clearance");
    expect(carriedLabels).toContain("SSS Document");
    expect(carriedLabels).toContain("Client NDA & Security Briefing");
    expect(carriedLabels).not.toContain("PhilHealth Member Data Record");

    // Verify compliance requirement records on the application
    const appReqs = await prisma.complianceRequirement.findMany({
      where: { applicationId: newAppA.id },
    });

    const nbiReq = appReqs.find((r) => r.documentLabel.toLowerCase().includes("nbi"));
    expect(nbiReq).toBeDefined();
    expect(nbiReq?.reviewStatus).toBe("APPROVED");
    expect(nbiReq?.documentId).toBe(501);
    expect(nbiReq?.reviewNotes).toContain("Carried over from prior approved deployment");

    const sssReq = appReqs.find((r) => r.documentLabel.toLowerCase().includes("sss"));
    expect(sssReq).toBeDefined();
    expect(sssReq?.reviewStatus).toBe("APPROVED");
    expect(sssReq?.documentId).toBe(502);

    const ndaReq = appReqs.find((r) => r.documentLabel.toLowerCase().includes("nda"));
    expect(ndaReq).toBeDefined();
    expect(ndaReq?.reviewStatus).toBe("APPROVED");
    expect(ndaReq?.documentId).toBe(506);

    // Verify RecruiterDecision was recorded
    const decision = await prisma.recruiterDecision.findFirst({
      where: { applicationId: newAppA.id, toStatus: "COMPLIANCE" },
    });
    expect(decision).toBeDefined();
    expect(decision?.actorId).toBe(testTA.id);

    // Verify EmploymentEvent REDEPLOYED was recorded
    const event = await prisma.employmentEvent.findFirst({
      where: { employeeId: returningEmployee.id, eventType: "REDEPLOYED" },
    });
    expect(event).toBeDefined();
  });

  it("4. Correctly carries over general clearances to a different client while excluding client-specific requirements", async () => {
    // newAppB is on clientB, while pastAppA was on clientA
    const result = await fastTrackRedeployment(newAppB.id, testTA.id, { targetStage: "FINAL_INTERVIEW" });

    expect(result.success).toBe(true);
    expect(result.application.status).toBe("FINAL_INTERVIEW");

    const carriedLabels = result.carriedOverDocuments.map((d: any) => d.documentLabel);

    // General clearances carry over across different clients
    expect(carriedLabels).toContain("NBI Clearance");
    expect(carriedLabels).toContain("SSS Document");

    // Client A specific NDA must NOT carry over to Client B
    expect(carriedLabels).not.toContain("Client NDA & Security Briefing");
  });

  it("5. Controller handler returns 200 with result payload and handles invalid inputs", async () => {
    const mockRes: any = {
      statusCode: 200,
      body: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.body = payload;
        return this;
      },
    };

    // Invalid ID returns 400
    await fastTrackRedeploymentHandler(
      { params: { id: "invalid" }, user: { id: testTA.id }, body: {} } as any,
      mockRes
    );
    expect(mockRes.statusCode).toBe(400);

    // Candidate without history returns 400
    await fastTrackRedeploymentHandler(
      { params: { id: String(freshApp.id) }, user: { id: testTA.id }, body: {} } as any,
      mockRes
    );
    expect(mockRes.statusCode).toBe(400);
    expect(mockRes.body.success).toBe(false);
  });

  it("6. Rejects fast-track if application is currently in late or terminal stage (e.g. COMPLIANCE, DEPLOYED)", async () => {
    // pastAppA is in DEPLOYED stage
    await expect(
      fastTrackRedeployment(pastAppA.id, testTA.id)
    ).rejects.toThrow(/Cannot fast-track application currently in DEPLOYED stage/i);

    // newAppA is in COMPLIANCE stage from test 3
    await expect(
      fastTrackRedeployment(newAppA.id, testTA.id)
    ).rejects.toThrow(/Cannot fast-track application currently in COMPLIANCE stage/i);
  });
});
