import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDeploymentHandler } from "../controllers/ta/ta.deployments.controller.js";
import { createDeployment } from "../services/ta/ta.deployments.service.js";

vi.mock("../services/ta/ta.deployments.service.js", () => ({
  createDeployment: vi.fn(),
  updateDeploymentStatus: vi.fn(),
  listDeployments: vi.fn(),
  getDeploymentDetails: vi.fn(),
  signDeploymentContract: vi.fn(),
  updateDeploymentContract: vi.fn(),
}));

describe("TA Deployments Contract Dates Validation", () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      params: { id: "101" },
      user: { id: "ta-user-123" },
      body: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("rejects when contractStart is missing", async () => {
    mockReq.body = {
      clientId: 1,
      contractEnd: "2026-12-31",
    };

    await createDeploymentHandler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: "Contract start date is required",
    });
    expect(createDeployment).not.toHaveBeenCalled();
  });

  it("accepts when contractEnd is missing", async () => {
    const mockDeployment = { id: 3, applicationId: 101, status: "READY_FOR_DEPLOYMENT" };
    vi.mocked(createDeployment).mockResolvedValueOnce(mockDeployment as any);

    mockReq.body = {
      clientId: 1,
      contractStart: "2026-01-01",
    };

    await createDeploymentHandler(mockReq, mockRes);

    expect(createDeployment).toHaveBeenCalledWith("ta-user-123", {
      applicationId: 101,
      clientId: 1,
      mrfId: undefined,
      site: undefined,
      contractStart: "2026-01-01",
      contractEnd: undefined,
      notes: undefined,
    });
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: "Deployment created successfully",
      data: mockDeployment,
    });
  });

  it("rejects when contractStart is an invalid date string", async () => {
    mockReq.body = {
      clientId: 1,
      contractStart: "invalid-date",
      contractEnd: "2026-12-31",
    };

    await createDeploymentHandler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: "Contract start date must be a valid date",
    });
    expect(createDeployment).not.toHaveBeenCalled();
  });

  it("rejects when contractEnd is an invalid date string", async () => {
    mockReq.body = {
      clientId: 1,
      contractStart: "2026-01-01",
      contractEnd: "invalid-date",
    };

    await createDeploymentHandler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: "Contract end date must be a valid date",
    });
    expect(createDeployment).not.toHaveBeenCalled();
  });

  it("rejects when contractStart is after contractEnd", async () => {
    mockReq.body = {
      clientId: 1,
      contractStart: "2026-12-31",
      contractEnd: "2026-01-01",
    };

    await createDeploymentHandler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: "Contract start date cannot be after contract end date",
    });
    expect(createDeployment).not.toHaveBeenCalled();
  });

  it("accepts valid dates where contractStart is before contractEnd", async () => {
    const mockDeployment = { id: 1, applicationId: 101, status: "READY_FOR_DEPLOYMENT" };
    vi.mocked(createDeployment).mockResolvedValueOnce(mockDeployment as any);

    mockReq.body = {
      clientId: 1,
      contractStart: "2026-01-01",
      contractEnd: "2026-12-31",
      site: "Main Branch",
      notes: "Standard contract",
    };

    await createDeploymentHandler(mockReq, mockRes);

    expect(createDeployment).toHaveBeenCalledWith("ta-user-123", {
      applicationId: 101,
      clientId: 1,
      mrfId: undefined,
      site: "Main Branch",
      contractStart: "2026-01-01",
      contractEnd: "2026-12-31",
      notes: "Standard contract",
    });
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: "Deployment created successfully",
      data: mockDeployment,
    });
  });

  it("accepts valid dates where contractStart equals contractEnd", async () => {
    const mockDeployment = { id: 2, applicationId: 101, status: "READY_FOR_DEPLOYMENT" };
    vi.mocked(createDeployment).mockResolvedValueOnce(mockDeployment as any);

    mockReq.body = {
      clientId: 1,
      contractStart: "2026-06-01",
      contractEnd: "2026-06-01",
    };

    await createDeploymentHandler(mockReq, mockRes);

    expect(createDeployment).toHaveBeenCalledWith("ta-user-123", {
      applicationId: 101,
      clientId: 1,
      mrfId: undefined,
      site: undefined,
      contractStart: "2026-06-01",
      contractEnd: "2026-06-01",
      notes: undefined,
    });
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: "Deployment created successfully",
      data: mockDeployment,
    });
  });
});
