import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import {
  createComplianceRequirement,
  generateComplianceRequirementsFromMRF,
  listComplianceRequirements,
  reviewComplianceRequirement,
  isFullyCompliant,
} from "../services/ta/ta.compliance.service.js";

describe("TA 201 Compliance Automation & Duplicate Prevention", () => {
  let testUser: any;
  let testTA: any;
  let testClient: any;
  let testMrf: any;
  let testJob: any;
  let testApp: any;

  beforeAll(async () => {
    const ts = Date.now();
    testUser = await prisma.user.create({
      data: {
        id: `cand-comp-${ts}`,
        email: `candidate-comp-${ts}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Carlos",
            lastName: "Mendoza",
            mobileNumber: "09171234567",
          },
        },
      },
    });

    testTA = await prisma.user.create({
      data: {
        id: `ta-comp-${ts}`,
        email: `ta-comp-${ts}@test.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Acme Construction Inc ${ts}`,
        industry: "Construction",
      },
    });

    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        title: "Site Engineer Requisition",
        createdById: testTA.id,
        status: "OPEN",
      },
    });

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "Site Engineer",
        description: "Civil & Site engineering",
        requirements: "Civil Eng Degree, PRC License",
        status: "OPEN",
      },
    });

    testApp = await prisma.application.create({
      data: {
        userId: testUser.id,
        jobPostingId: testJob.id,
        status: "COMPLIANCE",
      },
    });
  }, 25000);

  afterAll(async () => {
    try {
      if (testApp?.id) {
        await prisma.deploymentStatusHistory.deleteMany({ where: { deployment: { applicationId: testApp.id } } });
        await prisma.deployment.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.complianceRequirement.deleteMany({ where: { applicationId: testApp.id } });
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
        await prisma.notification.deleteMany({ where: { userId: testTA.id } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: testTA.id } });
      }
    } catch {
      // Best-effort cleanup
    }
  }, 25000);

  it("1. Automatically generates individual, structured compliance checklist items", async () => {
    const generated = await generateComplianceRequirementsFromMRF(testApp.id);
    expect(generated.length).toBeGreaterThanOrEqual(4);

    const list = await listComplianceRequirements(testApp.id);
    const labels = list.map((r) => r.documentLabel);

    expect(labels).toContain("NBI Clearance");
    expect(labels).toContain("Fit to Work Medical Exam");
    expect(labels).toContain("SSS Document");
    expect(labels).toContain("Client NDA & Security Briefing");

    // Ensure all items are initially PENDING and have auto-calculated SLA deadline
    list.forEach((r) => {
      expect(r.reviewStatus).toBe("PENDING");
      expect(r.isRequired).toBe(true);
      expect(r.deadline).toBeDefined();
      expect(new Date(r.deadline!).getTime()).toBeGreaterThan(Date.now());
    });
  }, 15000);

  it("2. Rejects adding duplicate compliance requirements (exact match)", async () => {
    await expect(
      createComplianceRequirement(testApp.id, "NBI Clearance", true, undefined, undefined, testTA.id)
    ).rejects.toThrow(/already exists for this application/);
  }, 15000);

  it("3. Rejects adding duplicate compliance requirements (case-insensitive & trimmed)", async () => {
    await expect(
      createComplianceRequirement(testApp.id, "  nbi clearance  ", true, undefined, undefined, testTA.id)
    ).rejects.toThrow(/already exists for this application/);
  }, 15000);

  it("4. Rejects bundled / multi-item comma-separated strings", async () => {
    await expect(
      createComplianceRequirement(testApp.id, "NBI, MEDICAL, SSS, NDA", true, undefined, undefined, testTA.id)
    ).rejects.toThrow(/Please create each compliance requirement individually/);
  }, 15000);

  it("5. Allows adding genuine custom requirements with custom or default deadline", async () => {
    const customDeadline = new Date(Date.now() + 10 * 86400000);
    const custom = await createComplianceRequirement(
      testApp.id,
      "PRC Board Certificate",
      true,
      customDeadline,
      undefined,
      testTA.id
    );

    expect(custom).toBeDefined();
    expect(custom.documentLabel).toBe("PRC Board Certificate");
    expect(new Date(custom.deadline!).getDate()).toBe(customDeadline.getDate());

    const updatedList = await listComplianceRequirements(testApp.id);
    expect(updatedList.some((r) => r.documentLabel === "PRC Board Certificate")).toBe(true);
  }, 15000);

  it("6. Allows updating and extending compliance requirement deadline", async () => {
    const list = await listComplianceRequirements(testApp.id);
    const targetItem = list[0];

    const extendedDeadline = new Date(Date.now() + 20 * 86400000);
    const { updateComplianceRequirementDeadline } = await import("../services/ta/ta.compliance.service.js");

    const updated = await updateComplianceRequirementDeadline(
      targetItem.id,
      extendedDeadline,
      testTA.id
    );

    expect(updated.deadline).toBeDefined();
    expect(new Date(updated.deadline!).getDate()).toBe(extendedDeadline.getDate());
  }, 15000);

  it("7. Gating: isFullyCompliant returns false while any mandatory requirement is PENDING", async () => {
    const compliant = await isFullyCompliant(testApp.id);
    expect(compliant).toBe(false);
  }, 15000);

  it("8. Gating: isFullyCompliant returns true when all mandatory requirements are APPROVED", async () => {
    const list = await listComplianceRequirements(testApp.id);
    for (const item of list) {
      await reviewComplianceRequirement(item.id, testTA.id, "APPROVED", "Verified authentic document");
    }

    const compliant = await isFullyCompliant(testApp.id);
    expect(compliant).toBe(true);
  }, 20000);
});
