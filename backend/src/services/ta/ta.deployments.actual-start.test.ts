import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  applicationUpdate: vi.fn(),
  decisionCreate: vi.fn(),
  employeeUpdate: vi.fn(),
  employmentEventCreate: vi.fn(),
  deploymentStatusHistoryCreate: vi.fn(),
  talentPoolUpdateMany: vi.fn(),
  applicantProfileFindUnique: vi.fn(),
  sendNotification: vi.fn(),
  notifyOwner: vi.fn(async () => 0),
  logAudit: vi.fn(),
}));

vi.mock("../../utils/prisma.js", () => {
  const tx = {
    deployment: { updateMany: mocks.updateMany, findUnique: mocks.findUnique, findMany: mocks.findMany },
    application: { update: mocks.applicationUpdate },
    recruiterDecision: { create: mocks.decisionCreate, updateMany: vi.fn() },
    employee: { update: mocks.employeeUpdate },
    employmentEvent: { create: mocks.employmentEventCreate },
    deploymentStatusHistory: { create: mocks.deploymentStatusHistoryCreate },
    applicantProfile: { findUnique: mocks.applicantProfileFindUnique },
    talentPoolMembership: { updateMany: mocks.talentPoolUpdateMany },
  };
  return {
    default: {
      ...tx,
      // Real prisma rolls back on a throw; the mock just propagates it, which is what the tests assert on.
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

vi.mock("../../utils/audit.js", () => ({ logAudit: mocks.logAudit }));

vi.mock("../../utils/notification.js", () => ({
  notifyJobOwner: vi.fn(async () => 0),
  notifyOwner: mocks.notifyOwner,
  sendNotification: mocks.sendNotification,
}));

import { activateDueDeployments, DeploymentConflictError, updateDeploymentStatus } from "./ta.deployments.service.js";
import { manilaDateString, toManilaDateOnly } from "../../schemas/field-limits.js";

const ACTIVE_ROW = {
  id: 42,
  status: "ACTIVE",
  employee: { id: 10, userId: "user-1", employeeNumber: "EMP-001", status: "ACTIVE" },
  client: { id: 5, name: "Client Corp" },
};

describe("Confirm site start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockImplementation(async (args: { include?: { application?: unknown } }) =>
      args?.include?.application
        ? {
            id: 42,
            status: "READY_FOR_DEPLOYMENT",
            employeeId: 10,
            applicationId: 7,
            client: { name: "Client Corp" },
            employee: { id: 10, userId: "user-1", employeeNumber: "EMP-001", status: "READY_FOR_DEPLOYMENT" },
            mrf: null,
            application: { id: 7, status: "CONTRACT_SIGNING" },
          }
        : ACTIVE_ROW
    );
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.applicationUpdate.mockResolvedValue({});
    mocks.decisionCreate.mockResolvedValue({});
    mocks.employeeUpdate.mockResolvedValue({ id: 10, status: "ACTIVE" });
    mocks.employmentEventCreate.mockResolvedValue({ id: 1 });
    mocks.deploymentStatusHistoryCreate.mockResolvedValue({ id: 1 });
    mocks.applicantProfileFindUnique.mockResolvedValue({ id: 99 });
    mocks.talentPoolUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects actual start dates in the past", async () => {
    await expect(
      updateDeploymentStatus(42, "ACTIVE", "Checked in", "actor-1", "2020-01-01")
    ).rejects.toThrow("Actual start date cannot be in the past. Please select today or a future date.");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it.each([manilaDateString()])("accepts %s and stores it as the Manila date", async (day) => {
    const updated = await updateDeploymentStatus(42, "ACTIVE", "Started on site", "actor-1", day);
    expect(updated).toBeDefined();
    const call = mocks.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 42, status: "READY_FOR_DEPLOYMENT" });
    expect(call.data.status).toBe("ACTIVE");
    expect(call.data.actualStart).toBeInstanceOf(Date);
    expect(toManilaDateOnly(call.data.actualStart)).toBe(day);
  });

  it("writes every record and notifies only after commit", async () => {
    await updateDeploymentStatus(42, "ACTIVE", "ok", "actor-1", manilaDateString());
    expect(mocks.applicationUpdate).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: "DEPLOYED" } });
    expect(mocks.decisionCreate).toHaveBeenCalledTimes(1);
    expect(mocks.deploymentStatusHistoryCreate).toHaveBeenCalledTimes(1);
    expect(mocks.employeeUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.employmentEventCreate).toHaveBeenCalledTimes(1);
    expect(mocks.talentPoolUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("a future start date only schedules the start: status, employee and application stay as they are", async () => {
    const updated = await updateDeploymentStatus(42, "ACTIVE", "Starts later", "actor-1", "2099-12-31");
    expect(updated).toBeDefined();
    const call = mocks.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 42, status: "READY_FOR_DEPLOYMENT" });
    expect(call.data.status).toBeUndefined();
    expect(toManilaDateOnly(call.data.actualStart)).toBe("2099-12-31");
    expect(mocks.employeeUpdate).not.toHaveBeenCalled();
    expect(mocks.applicationUpdate).not.toHaveBeenCalled();
    expect(mocks.employmentEventCreate).not.toHaveBeenCalled();
    expect(mocks.deploymentStatusHistoryCreate).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("the scheduled job may activate a start date that has already arrived", async () => {
    await updateDeploymentStatus(42, "ACTIVE", "Start date reached.", "actor-1", "2020-01-01", { allowPastStart: true });
    const call = mocks.updateMany.mock.calls[0][0];
    expect(call.data.status).toBe("ACTIVE");
    expect(toManilaDateOnly(call.data.actualStart)).toBe("2020-01-01");
    expect(mocks.employeeUpdate).toHaveBeenCalledWith({ where: { id: 10 }, data: { status: "ACTIVE" } });
  });

  it("the hourly job activates every due deployment and counts a failure without stopping", async () => {
    mocks.findMany.mockResolvedValueOnce([
      { id: 42, createdById: "creator", actualStart: new Date("2026-10-01T00:00:00+08:00") },
      { id: 43, createdById: "creator", actualStart: new Date("2026-10-02T00:00:00+08:00") },
    ]);
    mocks.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(activateDueDeployments()).resolves.toEqual({ activated: 1, failures: 1 });
    expect(mocks.findMany.mock.calls[0][0].where).toMatchObject({ status: "READY_FOR_DEPLOYMENT" });
    errors.mockRestore();
  });

  const writes: Array<[string, () => ReturnType<typeof vi.fn>]> = [
    ["deployment status update", () => mocks.updateMany],
    ["application update", () => mocks.applicationUpdate],
    ["recruiter decision", () => mocks.decisionCreate],
    ["status history", () => mocks.deploymentStatusHistoryCreate],
    ["employee update", () => mocks.employeeUpdate],
    ["employment event", () => mocks.employmentEventCreate],
    ["talent pool update", () => mocks.talentPoolUpdateMany],
  ];

  it.each(writes)("a failure at %s rejects and sends no notification", async (_name, getMock) => {
    getMock().mockRejectedValueOnce(new Error("db down"));
    await expect(updateDeploymentStatus(42, "ACTIVE", "ok", "actor-1", manilaDateString())).rejects.toThrow("db down");
    expect(mocks.sendNotification).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it("returns a 409 conflict when the status already changed and writes nothing else", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    const error = await updateDeploymentStatus(42, "ACTIVE", "ok", "actor-1", manilaDateString()).catch((e) => e);
    expect(error).toBeInstanceOf(DeploymentConflictError);
    expect(error.status).toBe(409);
    expect(mocks.applicationUpdate).not.toHaveBeenCalled();
    expect(mocks.employeeUpdate).not.toHaveBeenCalled();
    expect(mocks.employmentEventCreate).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("only one of two concurrent confirmations transitions", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const results = await Promise.allSettled([
      updateDeploymentStatus(42, "ACTIVE", "a", "actor-1", manilaDateString()),
      updateDeploymentStatus(42, "ACTIVE", "b", "actor-2", manilaDateString()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(mocks.employmentEventCreate).toHaveBeenCalledTimes(1);
    expect(mocks.deploymentStatusHistoryCreate).toHaveBeenCalledTimes(1);
  });
});
