import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { updateTAApplicationStatus } from "../services/ta/ta.applications.service.js";
import { executeHiring } from "../services/ta/ta.posthire.service.js";
import { createComplianceRequirement, reviewComplianceRequirement } from "../services/ta/ta.compliance.service.js";

describe("Hiring & Deployment Invariants & Auto-Provisioning", { timeout: 25000 }, () => {
  let taUser: any;
  let applicant1: any;
  let applicant2: any;
  let client: any;
  let job: any;
  let app1: any;
  let app2: any;

  beforeAll(async () => {
    taUser = await prisma.user.create({
      data: {
        id: `ta-inv-${Date.now()}`,
        email: `ta-inv-${Date.now()}@megs.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    client = await prisma.client.create({
      data: {
        name: `Client Auto-Inv ${Date.now()}`,
        industry: "Logistics",
        contactName: "Test Manager",
        contactEmail: `client-inv-${Date.now()}@test.com`,
      },
    });

    const mrf = await prisma.manpowerRequest.create({
      data: {
        client: { connect: { id: client.id } },
        createdBy: { connect: { id: taUser.id } },
        title: "Senior Backend Engineer MRF",
        headcount: 2,
        location: "Pasig HQ Site 1",
      },
    });

    job = await prisma.jobPosting.create({
      data: {
        title: "Senior Backend Engineer",
        description: "Senior Backend Engineer job description",
        requirements: "Node.js, TypeScript, PostgreSQL",
        location: "Pasig HQ Site 1",
        mrf: { connect: { id: mrf.id } },
        postedBy: { connect: { id: taUser.id } },
        status: "OPEN",
      },
    });

    applicant1 = await prisma.user.create({
      data: {
        id: `cand-inv1-${Date.now()}`,
        email: `cand1-${Date.now()}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Nathaniel",
            lastName: "Cruz",
            mobileNumber: "09694173825",
          },
        },
      },
    });

    applicant2 = await prisma.user.create({
      data: {
        id: `cand-inv2-${Date.now()}`,
        email: `cand2-${Date.now()}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Maria",
            lastName: "Santos",
            mobileNumber: "09181234567",
          },
        },
      },
    });

    app1 = await prisma.application.create({
      data: {
        user: { connect: { id: applicant1.id } },
        jobPosting: { connect: { id: job.id } },
        status: "FINAL_INTERVIEW",
      },
    });

    app2 = await prisma.application.create({
      data: {
        user: { connect: { id: applicant2.id } },
        jobPosting: { connect: { id: job.id } },
        status: "COMPLIANCE",
      },
    });

    // Final interview for app1
    await prisma.interview.create({
      data: {
        applicationId: app1.id,
        type: "FINAL_INTERVIEW",
        result: "PASS",
        scheduledAt: new Date(),
      },
    });

    // Compliance for app2
    const req = await createComplianceRequirement(app2.id, "NBI Clearance", true);
    const futureExpiry = new Date();
    futureExpiry.setDate(futureExpiry.getDate() + 180);
    await reviewComplianceRequirement(req.id, taUser.id, "APPROVED", "Clearance verified", futureExpiry);
  });

  afterAll(async () => {
    try {
      const userIds = [taUser?.id, applicant1?.id, applicant2?.id].filter(Boolean);
      await prisma.deploymentStatusHistory.deleteMany({ where: { changedById: { in: userIds } } });
      await prisma.employmentEvent.deleteMany({ where: { employee: { userId: { in: userIds } } } });
      await prisma.deployment.deleteMany({ where: { employee: { userId: { in: userIds } } } });
      await prisma.employee.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.complianceRequirement.deleteMany({ where: { applicationId: { in: [app1?.id, app2?.id].filter(Boolean) } } });
      await prisma.interview.deleteMany({ where: { applicationId: { in: [app1?.id, app2?.id].filter(Boolean) } } });
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: { in: [app1?.id, app2?.id].filter(Boolean) } } });
      await prisma.application.deleteMany({ where: { id: { in: [app1?.id, app2?.id].filter(Boolean) } } });
      await prisma.jobPosting.deleteMany({ where: { id: job?.id } });
      await prisma.manpowerRequest.deleteMany({ where: { clientId: client?.id } });
      await prisma.client.deleteMany({ where: { id: client?.id } });
      await prisma.applicantProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } catch {
      // Best-effort cleanup
    } finally {
      await prisma.$disconnect();
    }
  });

  it("TEST-INV-1: updateTAApplicationStatus to HIRED automatically creates Employee and EmploymentEvent", async () => {
    const res = await updateTAApplicationStatus(app1.id, "HIRED", taUser.id, "Passed technical panel");
    expect(res.status).toBe("HIRED");

    const employee = await prisma.employee.findUnique({
      where: { userId: applicant1.id },
      include: { employmentEvents: true },
    });

    expect(employee).toBeDefined();
    expect(employee?.status).toBe("ACTIVE");
    expect(employee?.originatingApplicationId).toBe(app1.id);
    expect(employee?.employmentEvents.some((e) => e.eventType === "HIRED")).toBe(true);
  });

  it("TEST-INV-2: updateTAApplicationStatus to DEPLOYED automatically creates Employee and Deployment record", async () => {
    const res = await updateTAApplicationStatus(app2.id, "DEPLOYED", taUser.id, "Dispatched to client location");
    expect(res.status).toBe("DEPLOYED");

    const employee = await prisma.employee.findUnique({
      where: { userId: applicant2.id },
      include: { deployments: true, employmentEvents: true },
    });

    expect(employee).toBeDefined();
    expect(employee?.status).toBe("ACTIVE");
    expect(employee?.deployments.length).toBeGreaterThanOrEqual(1);
    expect(employee?.deployments[0].clientId).toBe(client.id);
    expect(employee?.employmentEvents.some((e) => e.eventType === "DEPLOYED")).toBe(true);
  });
});
