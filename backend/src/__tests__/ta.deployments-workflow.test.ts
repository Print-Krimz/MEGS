import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import prisma from "../utils/prisma.js";
import {
  createDeployment,
  updateDeploymentStatus,
} from "../services/ta/ta.deployments.service.js";

describe("TA Site Deployment Status Workflow & State Machine", () => {
  let testUser: any;
  let testClient: any;
  let testEmployee: any;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `ta-deploy-test-${Date.now()}@example.com`,
        role: "TALENT_ACQUISITION",
        isActive: true,
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Deployment Client ${Date.now()}`,
        industry: "Logistics",
        contactName: "Site Supervisor",
        contactEmail: `client-${Date.now()}@example.com`,
        contactPhone: "09170001122",
        isActive: true,
      },
    });

    const empUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `emp-deploy-test-${Date.now()}@example.com`,
        role: "APPLICANT",
        isActive: true,
      },
    });

    testEmployee = await prisma.employee.create({
      data: {
        userId: empUser.id,
        employeeNumber: `EMP-${Date.now().toString().slice(-4)}`,
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    if (testEmployee) {
      await prisma.deploymentStatusHistory.deleteMany({
        where: { deployment: { employeeId: testEmployee.id } },
      });
      await prisma.employmentEvent.deleteMany({
        where: { employeeId: testEmployee.id },
      });
      await prisma.deployment.deleteMany({
        where: { employeeId: testEmployee.id },
      });
      await prisma.employee.delete({ where: { id: testEmployee.id } });
    }
    if (testClient) {
      await prisma.client.delete({ where: { id: testClient.id } });
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  it("creates deployment in READY_FOR_DEPLOYMENT status by default", async () => {
    const deployment = await createDeployment(testUser.id, {
      employeeId: testEmployee.id,
      clientId: testClient.id,
      site: "Main Distribution Center",
      notes: "Assigned to shift A",
    });

    expect(deployment).toBeDefined();
    expect(deployment.status).toBe("READY_FOR_DEPLOYMENT");
    expect(deployment.site).toBe("Main Distribution Center");
  });

  it("transitions READY_FOR_DEPLOYMENT -> ACTIVE successfully", async () => {
    const current = await prisma.deployment.findFirst({
      where: { employeeId: testEmployee.id, status: "READY_FOR_DEPLOYMENT" },
    });
    expect(current).toBeDefined();

    const updated = await updateDeploymentStatus(current!.id, "ACTIVE", "Employee checked in at site");
    expect(updated.status).toBe("ACTIVE");
  });

  it("blocks invalid transition from ACTIVE to CANCELLED (must use ENDED)", async () => {
    const current = await prisma.deployment.findFirst({
      where: { employeeId: testEmployee.id, status: "ACTIVE" },
    });
    expect(current).toBeDefined();

    await expect(
      updateDeploymentStatus(current!.id, "CANCELLED" as any, "Invalid cancel")
    ).rejects.toThrow(/Cannot transition deployment from ACTIVE to CANCELLED/);
  });

  it("transitions ACTIVE -> ENDED successfully", async () => {
    const current = await prisma.deployment.findFirst({
      where: { employeeId: testEmployee.id, status: "ACTIVE" },
    });
    expect(current).toBeDefined();

    const updated = await updateDeploymentStatus(current!.id, "ENDED", "Contract concluded");
    expect(updated.status).toBe("ENDED");
  });

  it("blocks transitions from terminal ENDED status", async () => {
    const current = await prisma.deployment.findFirst({
      where: { employeeId: testEmployee.id, status: "ENDED" },
    });
    expect(current).toBeDefined();

    await expect(
      updateDeploymentStatus(current!.id, "ACTIVE" as any)
    ).rejects.toThrow(/Cannot transition deployment from ENDED/);
  });

  it("supports cancellation directly from READY_FOR_DEPLOYMENT for pre-start changes", async () => {
    // Create new deployment for test
    const newEmpUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `emp-cancel-test-${Date.now()}@example.com`,
        role: "APPLICANT",
        isActive: true,
      },
    });
    const newEmp = await prisma.employee.create({
      data: {
        userId: newEmpUser.id,
        employeeNumber: `EMP-${Date.now().toString().slice(-4)}B`,
        status: "ACTIVE",
      },
    });

    const deployment = await createDeployment(testUser.id, {
      employeeId: newEmp.id,
      clientId: testClient.id,
      site: "Secondary Site",
    });
    expect(deployment.status).toBe("READY_FOR_DEPLOYMENT");

    const cancelled = await updateDeploymentStatus(deployment.id, "CANCELLED", "Candidate declined site assignment");
    expect(cancelled.status).toBe("CANCELLED");

    // Clean up
    await prisma.deploymentStatusHistory.deleteMany({ where: { deploymentId: deployment.id } });
    await prisma.employmentEvent.deleteMany({ where: { employeeId: newEmp.id } });
    await prisma.deployment.delete({ where: { id: deployment.id } });
    await prisma.employee.delete({ where: { id: newEmp.id } });
    await prisma.user.delete({ where: { id: newEmpUser.id } });
  });
});
