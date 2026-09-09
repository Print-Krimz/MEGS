import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import prisma from "../utils/prisma.js";
import {
  calculateMRFFulfillment,
  syncMRFFulfillmentStatus,
  listMRFs,
  getMRFDetails,
} from "../services/ta/ta.mrf.service.js";
import {
  createDeployment,
  updateDeploymentStatus,
} from "../services/ta/ta.deployments.service.js";

describe("MRF Headcount Fulfillment & Job Auto-Closure", () => {
  let testTA: any;
  let testClient: any;
  let testMrf: any;
  let regularJob: any;
  let evergreenJob: any;
  let user1: any;
  let user2: any;
  let emp1: any;
  let emp2: any;

  beforeAll(async () => {
    testTA = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `ta-fc-${Date.now()}@test.com`,
        role: "TALENT_ACQUISITION",
        isActive: true,
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Fulfillment Client ${Date.now()}`,
        industry: "Logistics",
        contactName: "Ops Lead",
        contactEmail: `client-${Date.now()}@test.com`,
        isActive: true,
      },
    });

    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        createdById: testTA.id,
        title: "Logistics Crew",
        headcount: 2,
        status: "OPEN",
      },
    });

    regularJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "Standard Logistics Crew",
        description: "Standard role",
        requirements: "Logistics",
        status: "OPEN",
        isEvergreen: false,
      },
    });

    evergreenJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "Evergreen Logistics Pool",
        description: "Pool role",
        requirements: "Logistics",
        status: "OPEN",
        isEvergreen: true, // Should NOT close when MRF is filled
      },
    });

    user1 = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `u1-${Date.now()}@test.com`,
        role: "APPLICANT",
        isActive: true,
      },
    });
    await prisma.applicantProfile.create({
      data: {
        userId: user1.id,
        firstName: "First1",
        lastName: "Last1",
      },
    });
    emp1 = await prisma.employee.create({
      data: {
        userId: user1.id,
        employeeNumber: `E1-${Date.now()}`,
        status: "ACTIVE",
      },
    });

    user2 = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `u2-${Date.now()}@test.com`,
        role: "APPLICANT",
        isActive: true,
      },
    });
    await prisma.applicantProfile.create({
      data: {
        userId: user2.id,
        firstName: "First2",
        lastName: "Last2",
      },
    });
    emp2 = await prisma.employee.create({
      data: {
        userId: user2.id,
        employeeNumber: `E2-${Date.now()}`,
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    if (testMrf) {
      await prisma.deploymentStatusHistory.deleteMany({
        where: { deployment: { mrfId: testMrf.id } },
      });
      await prisma.deployment.deleteMany({ where: { mrfId: testMrf.id } });
      await prisma.jobPosting.deleteMany({ where: { mrfId: testMrf.id } });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entity: "ManpowerRequest", entityId: testMrf.id },
            { userId: { in: [testTA.id, user1.id, user2.id] } },
          ],
        },
      }).catch(() => {});
      await prisma.manpowerRequest.deleteMany({ where: { id: testMrf.id } });
    }
    if (emp1 && emp2) {
      await prisma.employmentEvent.deleteMany({
        where: { employeeId: { in: [emp1.id, emp2.id] } },
      });
      await prisma.employee.deleteMany({
        where: { id: { in: [emp1.id, emp2.id] } },
      });
    }
    if (user1 && user2 && testTA) {
      await prisma.applicantProfile.deleteMany({
        where: { userId: { in: [user1.id, user2.id] } },
      });
      await prisma.notification.deleteMany({
        where: { userId: { in: [user1.id, user2.id, testTA.id] } },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: [user1.id, user2.id, testTA.id] } },
      }).catch(() => {});
    }
    if (testClient) {
      await prisma.client.deleteMany({ where: { id: testClient.id } });
    }
  });

  it("calculates accurate fulfillment before and after deployments", async () => {
    const initial = await calculateMRFFulfillment(testMrf.id);
    expect(initial.headcount).toBe(2);
    expect(initial.deployedCount).toBe(0);
    expect(initial.remainingCount).toBe(2);
    expect(initial.fulfillmentRate).toBe(0);
    expect(initial.isFulfilled).toBe(false);

    await prisma.deployment.create({
      data: {
        employeeId: emp1.id,
        clientId: testClient.id,
        mrfId: testMrf.id,
        createdById: testTA.id,
        status: "ACTIVE",
      },
    });

    const half = await calculateMRFFulfillment(testMrf.id);
    expect(half.headcount).toBe(2);
    expect(half.deployedCount).toBe(1);
    expect(half.remainingCount).toBe(1);
    expect(half.fulfillmentRate).toBe(50);
    expect(half.isFulfilled).toBe(false);
  });

  it("auto-transitions MRF to FILLED, closes standard job, and leaves evergreen job OPEN", async () => {
    await prisma.deployment.create({
      data: {
        employeeId: emp2.id,
        clientId: testClient.id,
        mrfId: testMrf.id,
        createdById: testTA.id,
        status: "READY_FOR_DEPLOYMENT",
      },
    });

    const syncResult = await syncMRFFulfillmentStatus(testMrf.id, testTA.id);
    expect(syncResult.updated).toBe(true);
    expect(syncResult.previousStatus).toBe("OPEN");
    expect(syncResult.newStatus).toBe("FILLED");
    expect(syncResult.closedJobCount).toBe(1);
    expect(syncResult.reopenedJobCount).toBe(0);

    const refreshedStandardJob = await prisma.jobPosting.findUnique({
      where: { id: regularJob.id },
    });
    expect(refreshedStandardJob?.status).toBe("CLOSED");

    const refreshedEvergreenJob = await prisma.jobPosting.findUnique({
      where: { id: evergreenJob.id },
    });
    expect(refreshedEvergreenJob?.status).toBe("OPEN"); // Evergreen stays OPEN
  });

  it("auto-reopens MRF to OPEN and reopens standard job when deployment is cancelled", async () => {
    const depToCancel = await prisma.deployment.findFirst({
      where: { mrfId: testMrf.id, employeeId: emp2.id },
    });
    await prisma.deployment.update({
      where: { id: depToCancel!.id },
      data: { status: "CANCELLED" },
    });

    const syncResult = await syncMRFFulfillmentStatus(testMrf.id, testTA.id);
    expect(syncResult.updated).toBe(true);
    expect(syncResult.previousStatus).toBe("FILLED");
    expect(syncResult.newStatus).toBe("OPEN");
    expect(syncResult.closedJobCount).toBe(0);
    expect(syncResult.reopenedJobCount).toBe(1);

    const refreshedStandardJob = await prisma.jobPosting.findUnique({
      where: { id: regularJob.id },
    });
    expect(refreshedStandardJob?.status).toBe("OPEN");
  });

  it("enriches listMRFs and getMRFDetails with computed fulfillment and deployment employee info", async () => {
    const mrfs = await listMRFs(testClient.id);
    const listed = mrfs.find((m: any) => m.id === testMrf.id);
    expect(listed).toBeDefined();
    expect(listed.fulfillment).toBeDefined();
    expect(listed.fulfillment.headcount).toBe(2);
    expect(listed.fulfillment.deployedCount).toBe(1);
    expect(listed.fulfillment.remainingCount).toBe(1);
    expect(listed.fulfillment.fulfillmentRate).toBe(50);
    expect(listed.fulfillment.isFulfilled).toBe(false);

    const details = await getMRFDetails(testMrf.id);
    expect(details.fulfillment).toBeDefined();
    expect(details.fulfillment.headcount).toBe(2);
    expect(details.fulfillment.deployedCount).toBe(1);
    expect(details.deployments.length).toBeGreaterThan(0);
    const depWithEmp = details.deployments.find((d: any) => d.employeeId === emp1.id);
    expect(depWithEmp).toBeDefined();
    expect(depWithEmp.employee).toBeDefined();
    expect(depWithEmp.employee.employeeNumber).toBe(emp1.employeeNumber);
    expect(depWithEmp.employee.user?.applicantProfile?.firstName).toBe("First1");
  });
});

describe("Deployment Quota Hard Guard", () => {
  let guardTA: any;
  let guardClient: any;
  let guardMrf: any;
  let userA: any;
  let userB: any;
  let empA: any;
  let empB: any;
  let dep1: any;

  beforeAll(async () => {
    guardTA = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `ta-guard-${Date.now()}@test.com`,
        role: "TALENT_ACQUISITION",
        isActive: true,
      },
    });

    guardClient = await prisma.client.create({
      data: {
        name: `Guard Client ${Date.now()}`,
        industry: "Retail",
        contactName: "Store Lead",
        contactEmail: `client-guard-${Date.now()}@test.com`,
        isActive: true,
      },
    });

    guardMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: guardClient.id,
        createdById: guardTA.id,
        title: "Retail Cashier Solo",
        headcount: 1,
        status: "OPEN",
      },
    });

    userA = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `ua-guard-${Date.now()}@test.com`,
        role: "APPLICANT",
        isActive: true,
      },
    });
    await prisma.applicantProfile.create({
      data: {
        userId: userA.id,
        firstName: "Alpha",
        lastName: "Candidate",
      },
    });
    empA = await prisma.employee.create({
      data: {
        userId: userA.id,
        employeeNumber: `EG-A-${Date.now()}`,
        status: "ACTIVE",
      },
    });

    userB = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `ub-guard-${Date.now()}@test.com`,
        role: "APPLICANT",
        isActive: true,
      },
    });
    await prisma.applicantProfile.create({
      data: {
        userId: userB.id,
        firstName: "Beta",
        lastName: "Candidate",
      },
    });
    empB = await prisma.employee.create({
      data: {
        userId: userB.id,
        employeeNumber: `EG-B-${Date.now()}`,
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    if (guardMrf) {
      await prisma.deploymentStatusHistory.deleteMany({
        where: { deployment: { mrfId: guardMrf.id } },
      }).catch(() => {});
      await prisma.deployment.deleteMany({ where: { mrfId: guardMrf.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entity: "ManpowerRequest", entityId: guardMrf.id },
            { userId: { in: [guardTA.id, userA.id, userB.id] } },
          ],
        },
      }).catch(() => {});
      await prisma.manpowerRequest.deleteMany({ where: { id: guardMrf.id } }).catch(() => {});
    }
    if (empA && empB) {
      await prisma.deploymentStatusHistory.deleteMany({
        where: { deployment: { employeeId: { in: [empA.id, empB.id] } } },
      }).catch(() => {});
      await prisma.deployment.deleteMany({
        where: { employeeId: { in: [empA.id, empB.id] } },
      }).catch(() => {});
      await prisma.employmentEvent.deleteMany({
        where: { employeeId: { in: [empA.id, empB.id] } },
      }).catch(() => {});
      await prisma.employee.deleteMany({
        where: { id: { in: [empA.id, empB.id] } },
      }).catch(() => {});
    }
    if (userA && userB && guardTA) {
      await prisma.applicantProfile.deleteMany({
        where: { userId: { in: [userA.id, userB.id] } },
      }).catch(() => {});
      await prisma.notification.deleteMany({
        where: { userId: { in: [userA.id, userB.id, guardTA.id] } },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: [userA.id, userB.id, guardTA.id] } },
      }).catch(() => {});
    }
    if (guardClient) {
      await prisma.client.deleteMany({ where: { id: guardClient.id } }).catch(() => {});
    }
  });

  it("enforces headcount limit upon deployment creation and auto-syncs MRF status to FILLED", async () => {
    // 1st deployment succeeds
    dep1 = await createDeployment(guardTA.id, {
      employeeId: empA.id,
      clientId: guardClient.id,
      mrfId: guardMrf.id,
    });
    expect(dep1).toBeDefined();
    expect(dep1.id).toBeDefined();

    // Verify MRF status transitioned to FILLED
    const mrfAfter1st = await prisma.manpowerRequest.findUnique({
      where: { id: guardMrf.id },
    });
    expect(mrfAfter1st?.status).toBe("FILLED");

    // 2nd deployment must be rejected due to quota
    await expect(
      createDeployment(guardTA.id, {
        employeeId: empB.id,
        clientId: guardClient.id,
        mrfId: guardMrf.id,
      })
    ).rejects.toThrow(/headcount limit of 1 pax has already been reached/);
  }, 30000);

  it("auto-reopens MRF to OPEN when active deployment is cancelled", async () => {
    // Cancel 1st deployment
    await updateDeploymentStatus(dep1.id, "CANCELLED", "Deployment cancelled by client", guardTA.id);

    // Verify MRF status reopened to OPEN
    const mrfAfterCancel = await prisma.manpowerRequest.findUnique({
      where: { id: guardMrf.id },
    });
    expect(mrfAfterCancel?.status).toBe("OPEN");

    // Now 2nd deployment can succeed
    const dep2 = await createDeployment(guardTA.id, {
      employeeId: empB.id,
      clientId: guardClient.id,
      mrfId: guardMrf.id,
    });
    expect(dep2).toBeDefined();
    expect(dep2.id).toBeDefined();

    const mrfAfter2nd = await prisma.manpowerRequest.findUnique({
      where: { id: guardMrf.id },
    });
    expect(mrfAfter2nd?.status).toBe("FILLED");
  }, 30000);
});
