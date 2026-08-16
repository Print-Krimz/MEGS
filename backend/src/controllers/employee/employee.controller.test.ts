import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../utils/prisma.js", () => ({ default: {} }));
vi.mock("../../utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../services/employee/employee.service.js", () => ({
  getDigital201ByEmployeeId: vi.fn(),
  getDigital201ByUserId: vi.fn(),
  listEmployees: vi.fn(),
  getEmployeeById: vi.fn(),
  updateEmployeeStatus: vi.fn(),
  createEmployeeDeployment: vi.fn(),
  endEmployeeDeployment: vi.fn(),
  getEmployeeEmploymentHistory: vi.fn(),
}));

import {
  getDigital201Handler,
  getMyDigital201Handler,
  getEmployeeHandler,
  listEmployeesHandler,
  updateEmployeeStatusHandler,
  createEmployeeDeploymentHandler,
  endEmployeeDeploymentHandler,
  getEmployeeEmploymentHistoryHandler,
} from "./employee.controller.js";

import {
  getDigital201ByEmployeeId,
  getDigital201ByUserId,
  listEmployees,
  getEmployeeById,
  updateEmployeeStatus,
  createEmployeeDeployment,
  endEmployeeDeployment,
  getEmployeeEmploymentHistory,
} from "../../services/employee/employee.service.js";

const mockResponse = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
};

describe("Employee & Digital 201 Controller Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/employees/:id/digital-201", () => {
    it("returns 403 Forbidden if APPLICANT user requests another candidate's Digital 201", async () => {
      const res = mockResponse();
      const mockDigital201: any = {
        employee: { id: 1, userId: "user-123", employeeNumber: "EMP-001" },
      };
      vi.mocked(getDigital201ByEmployeeId).mockResolvedValue(mockDigital201);

      const req: any = {
        params: { id: "1" },
        user: { id: "intruder-user-999", role: "APPLICANT" },
      };

      await getDigital201Handler(req, res as any);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Forbidden/i),
        })
      );
    });

    it("allows TA/Admin role to access any employee's Digital 201", async () => {
      const res = mockResponse();
      const mockDigital201: any = {
        employee: { id: 1, userId: "user-123", employeeNumber: "EMP-001" },
      };
      vi.mocked(getDigital201ByEmployeeId).mockResolvedValue(mockDigital201);

      const req: any = {
        params: { id: "1" },
        user: { id: "ta-admin-user", role: "TALENT_ACQUISITION" },
      };

      await getDigital201Handler(req, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockDigital201,
        })
      );
    });
  });

  describe("GET /api/employees/me/digital-201", () => {
    it("returns the personal Digital 201 for the authenticated user", async () => {
      const res = mockResponse();
      const mockDigital201: any = {
        employee: { id: 1, userId: "user-123", employeeNumber: "EMP-001" },
      };
      vi.mocked(getDigital201ByUserId).mockResolvedValue(mockDigital201);

      const req: any = {
        user: { id: "user-123", role: "APPLICANT" },
      };

      await getMyDigital201Handler(req, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockDigital201,
        })
      );
    });
  });

  describe("PATCH /api/employees/:id/status", () => {
    it("updates employee status and returns updated record", async () => {
      const res = mockResponse();
      const mockUpdated: any = { id: 1, status: "AVAILABLE_FOR_REDEPLOYMENT" };
      vi.mocked(updateEmployeeStatus).mockResolvedValue(mockUpdated);

      const req: any = {
        params: { id: "1" },
        body: { status: "AVAILABLE_FOR_REDEPLOYMENT", reason: "Assignment ended early" },
        user: { id: "ta-user", role: "TALENT_ACQUISITION" },
      };

      await updateEmployeeStatusHandler(req, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockUpdated,
        })
      );
    });
  });

  describe("POST /api/employees/:id/deployments", () => {
    it("creates deployment for employee and returns 201", async () => {
      const res = mockResponse();
      const mockDeployment: any = { id: 10, employeeId: 1, clientId: 5, status: "READY_FOR_DEPLOYMENT" };
      vi.mocked(createEmployeeDeployment).mockResolvedValue(mockDeployment);

      const req: any = {
        params: { id: "1" },
        body: { clientId: 5, site: "Warehouse Hub" },
        user: { id: "ta-user", role: "TALENT_ACQUISITION" },
      };

      await createEmployeeDeploymentHandler(req, res as any);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockDeployment,
        })
      );
    });
  });

  describe("POST /api/deployments/:id/end", () => {
    it("ends deployment and returns updated record", async () => {
      const res = mockResponse();
      const mockEnded: any = { id: 10, status: "ENDED" };
      vi.mocked(endEmployeeDeployment).mockResolvedValue(mockEnded);

      const req: any = {
        params: { id: "10" },
        body: { reason: "Project completed", makeAvailableForRedeployment: true },
        user: { id: "ta-user", role: "TALENT_ACQUISITION" },
      };

      await endEmployeeDeploymentHandler(req, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockEnded,
        })
      );
    });
  });
});
