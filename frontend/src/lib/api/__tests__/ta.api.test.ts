import { describe, it, expect, vi, beforeEach } from "vitest";
import { taApi } from "../ta.api";
import { employeesApi } from "../employees.api";
import { documentsApi } from "../documents.api";
import { api } from "../client";
import { ApplicationStatus, JobStatus } from "../../types/enums";

vi.mock("../client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

describe("Talent Acquisition APIs (TDD)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("taApi - Applications & Decisions", () => {
    it("lists applications with filters", async () => {
      const mockApps = [{ id: 1, status: ApplicationStatus.SUBMITTED }];
      vi.mocked(api.get).mockResolvedValueOnce(mockApps as any);

      const result = await taApi.listApplications({ status: ApplicationStatus.SUBMITTED, page: 1, limit: 10 });
      expect(api.get).toHaveBeenCalledWith("/api/ta/applications?status=SUBMITTED&page=1&limit=10");
      expect(result).toEqual(mockApps);
    });

    it("retrieves full application details", async () => {
      const mockApplication = { id: 1, status: ApplicationStatus.INITIAL_SCREENING };
      vi.mocked(api.get).mockResolvedValueOnce(mockApplication as any);

      const result = await taApi.getApplication(1);
      expect(api.get).toHaveBeenCalledWith("/api/ta/applications/1");
      expect(result).toEqual(mockApplication);
    });

    it("updates application pipeline status with reason", async () => {
      vi.mocked(api.patch).mockResolvedValueOnce({ id: 1, status: ApplicationStatus.CLIENT_ENDORSEMENT } as any);

      const result = await taApi.updateApplicationStatus(1, {
        status: ApplicationStatus.CLIENT_ENDORSEMENT,
        reason: "Passed initial screening with high marks",
      });
      expect(api.patch).toHaveBeenCalledWith("/api/ta/applications/1/status", {
        status: ApplicationStatus.CLIENT_ENDORSEMENT,
        reason: "Passed initial screening with high marks",
      });
      expect(result.status).toBe(ApplicationStatus.CLIENT_ENDORSEMENT);
    });

    it("triggers AI analysis on an application", async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ success: true, score: 85 } as any);

      const result = await taApi.analyzeApplication(1);
      expect(api.post).toHaveBeenCalledWith("/api/ta/applications/1/analyze", {});
      expect(result).toEqual({ success: true, score: 85 });
    });
  });

  describe("taApi - Jobs, MRFs & Clients", () => {
    it("creates a job requisition", async () => {
      const jobData = {
        title: "Warehouse Forklift Operator",
        description: "Operate heavy warehouse machinery",
        requirements: "Valid TESDA Forklift NC II",
        location: "Calamba, Laguna",
        status: JobStatus.OPEN,
      };
      vi.mocked(api.post).mockResolvedValueOnce({ ...jobData, id: 10 } as any);

      const result = await taApi.createJob(jobData);
      expect(api.post).toHaveBeenCalledWith("/api/ta/jobs", jobData);
      expect(result.id).toBe(10);
    });

    it("retrieves ranked candidate matches for a job requisition", async () => {
      const mockRanked = [{ id: 1, finalFitScore: 92 }];
      vi.mocked(api.get).mockResolvedValueOnce(mockRanked as any);

      const result = await taApi.getRankedCandidates(10);
      expect(api.get).toHaveBeenCalledWith("/api/ta/jobs/10/ranked-candidates");
      expect(result).toEqual(mockRanked);
    });

    it("lists MRFs with client details", async () => {
      const mockMRFs = [{ id: 100, title: "10x Security Officers", clientId: 5 }];
      vi.mocked(api.get).mockResolvedValueOnce(mockMRFs as any);

      const result = await taApi.listMRFs();
      expect(api.get).toHaveBeenCalledWith("/api/ta/mrfs");
      expect(result).toEqual(mockMRFs);
    });

    it("creates a client account", async () => {
      const clientData = { name: "San Miguel Logistics", industry: "Supply Chain" };
      vi.mocked(api.post).mockResolvedValueOnce({ ...clientData, id: 5 } as any);

      const result = await taApi.createClient(clientData);
      expect(api.post).toHaveBeenCalledWith("/api/ta/clients", clientData);
      expect(result.id).toBe(5);
    });
  });

  describe("employeesApi - Digital 201 & Deployment Management", () => {
    it("lists employees with status filtering", async () => {
      const mockEmployees = [{ id: 1, employeeNumber: "EMP-2026-001" }];
      vi.mocked(api.get).mockResolvedValueOnce(mockEmployees as any);

      const result = await employeesApi.listEmployees({ status: "ACTIVE" as any });
      expect(api.get).toHaveBeenCalledWith("/api/employees?status=ACTIVE");
      expect(result).toEqual(mockEmployees);
    });

    it("retrieves Digital 201 aggregate record", async () => {
      const mock201 = { employee: { id: 1 }, candidate: { firstName: "Juan" } };
      vi.mocked(api.get).mockResolvedValueOnce(mock201 as any);

      const result = await employeesApi.getDigital201(1);
      expect(api.get).toHaveBeenCalledWith("/api/employees/1/digital-201");
      expect(result).toEqual(mock201);
    });
  });

  describe("documentsApi - Secure Proxy Downloads", () => {
    it("generates document download url", () => {
      const url = documentsApi.getDownloadUrl(42);
      expect(url).toBe("/api/documents/42/download");
    });
  });
});
