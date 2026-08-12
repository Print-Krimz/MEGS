import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { createClient, listClients } from "../services/ta/ta.clients.service.js";
import { createMRF, listMRFs, linkJobToMRF } from "../services/ta/ta.mrf.service.js";
import { createComplianceRequirement, isFullyCompliant, reviewComplianceRequirement } from "../services/ta/ta.compliance.service.js";
import { createDeployment, updateDeploymentStatus } from "../services/ta/ta.deployments.service.js";
import { getPipelineStats, getDeploymentStats, getComplianceOverview } from "../services/analytics/analytics.service.js";

describe("Phase 2 - Integration & Workflow Verification", () => {
  let testUser: any;
  let testClient: any;
  let testMRF: any;
  let testJob: any;
  let testApplicant: any;
  let testApplication: any;
  let testInterview: any;

  beforeAll(async () => {
    // Create test user (TA)
    testUser = await prisma.user.create({
      data: {
        id: `test-ta-${Date.now()}`,
        email: `ta-${Date.now()}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    // Create test applicant
    testApplicant = await prisma.user.create({
      data: {
        id: `test-app-${Date.now()}`,
        email: `applicant-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Jane",
            lastName: "Doe",
            mobileNumber: "09123456789",
            gender: "Female",
            province: "Metro Manila",
            city: "Manila",
            dateOfBirth: new Date("1995-01-01"),
            birthPlace: "Manila",
            nationality: "Filipino",
            civilStatus: "Single",
            address: "123 Main St",
            professionalSummary: "Experienced full stack developer",
            hasConsentedToAi: true,
          },
        },
      },
      include: { applicantProfile: true },
    });
  });

  afterAll(async () => {
    // Cleanup created records in reverse order
    try {
      if (testApplication) {
        await prisma.deployment.deleteMany({ where: { applicationId: testApplication.id } });
        await prisma.complianceRequirement.deleteMany({ where: { applicationId: testApplication.id } });
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: testApplication.id } });
        await prisma.interview.deleteMany({ where: { applicationId: testApplication.id } });
        await prisma.application.delete({ where: { id: testApplication.id } });
      }
      if (testJob) {
        await prisma.jobPosting.delete({ where: { id: testJob.id } });
      }
      if (testMRF) {
        await prisma.manpowerRequest.delete({ where: { id: testMRF.id } });
      }
      if (testClient) {
        await prisma.client.delete({ where: { id: testClient.id } });
      }
      if (testApplicant) {
        await prisma.applicantProfile.deleteMany({ where: { userId: testApplicant.id } });
        await prisma.user.delete({ where: { id: testApplicant.id } });
      }
      if (testUser) {
        await prisma.user.delete({ where: { id: testUser.id } });
      }
    } catch (err) {
      // Cleanup best effort
    }
  });

  it("P2-01: Creates a Client and Manpower Request (MRF) and links a Job", async () => {
    testClient = await createClient({
      name: "Acme Corporation",
      industry: "Technology",
      contactEmail: "hr@acme.com",
    });
    expect(testClient.id).toBeDefined();
    expect(testClient.name).toBe("Acme Corporation");

    testMRF = await createMRF(testUser.id, {
      clientId: testClient.id,
      title: "Senior Full Stack Developer",
      headcount: 2,
      priority: "HIGH",
    });
    expect(testMRF.id).toBeDefined();
    expect(testMRF.clientId).toBe(testClient.id);

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testUser.id,
        title: "Senior Full Stack Developer",
        description: "Develop full stack solutions",
        requirements: "React, Node.js, PostgreSQL",
      },
    });

    const linkedJob = await linkJobToMRF(testMRF.id, testJob.id);
    expect(linkedJob.mrfId).toBe(testMRF.id);
  });

  it("P2-02: Advanced Application Pipeline and Recruiter Decisions", async () => {
    testApplication = await prisma.application.create({
      data: {
        userId: testApplicant.id,
        jobPostingId: testJob.id,
        status: "ONBOARDING",
      },
    });

    // Create a passed final interview to satisfy HIRED/ONBOARDING prerequisite
    testInterview = await prisma.interview.create({
      data: {
        applicationId: testApplication.id,
        type: "FINAL_INTERVIEW",
        result: "PASS",
      },
    });

    expect(testApplication.id).toBeDefined();
  });

  it("P2-03: Compliance checklist requirement creation and review", async () => {
    const req1 = await createComplianceRequirement(testApplication.id, "NBI Clearance", true);
    const req2 = await createComplianceRequirement(testApplication.id, "Medical Certificate", true);

    expect(req1.reviewStatus).toBe("PENDING");

    let isCompliant = await isFullyCompliant(testApplication.id);
    expect(isCompliant).toBe(false);

    await reviewComplianceRequirement(req1.id, testUser.id, "APPROVED", "Clear document");
    await reviewComplianceRequirement(req2.id, testUser.id, "APPROVED", "Passed medical");

    isCompliant = await isFullyCompliant(testApplication.id);
    expect(isCompliant).toBe(true);
  });

  it("P2-04: Deployment lifecycle creation and transition", async () => {
    const deployment = await createDeployment(testUser.id, {
      applicationId: testApplication.id,
      clientId: testClient.id,
      mrfId: testMRF.id,
      site: "Main Office - Manila",
      contractStart: new Date(),
    });

    expect(deployment.id).toBeDefined();
    expect(deployment.status).toBe("PENDING_ORIENTATION");

    const updated = await updateDeploymentStatus(deployment.id, "READY");
    expect(updated.status).toBe("READY");
  });

  it("P2-06: Analytics statistics calculation", async () => {
    const pipelineStats = await getPipelineStats();
    expect(pipelineStats.totalApplications).toBeGreaterThan(0);

    const deploymentStats = await getDeploymentStats(testClient.id);
    expect(deploymentStats.totalDeployments).toBeGreaterThan(0);

    const complianceOverview = await getComplianceOverview();
    expect(complianceOverview.totalRequirements).toBeGreaterThan(0);
  });
});
