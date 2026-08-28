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

  describe("taApi - Talent Pool & Candidate Matching", () => {
    it("searches talent pool by text or criteria and unwraps items payload", async () => {
      const mockResult = {
        items: [
          {
            candidate: {
              id: "user-1",
              applicantProfileId: 10,
              membershipId: 100,
              email: "carlos@example.com",
              firstName: "Carlos",
              lastName: "Mendoza",
              city: "Makati",
              province: "Metro Manila",
              currentRole: "Senior Engineer",
              skills: ["TypeScript", "React"],
              availability: "AVAILABLE",
              talentPoolStatus: "ACTIVE",
              lastContactedAt: null,
            },
            similarity: 0.92,
            knnRank: 1,
          },
        ],
      };
      vi.mocked(api.post).mockResolvedValueOnce(mockResult as any);

      const result = await taApi.searchTalentPool({ text: "TypeScript", k: 10 });
      expect(api.post).toHaveBeenCalledWith("/api/ta/talent-pool/search", { text: "TypeScript", k: 10 });
      expect(result).toEqual(mockResult.items);
    });

    it("retrieves talent pool matches for a specific job requisition", async () => {
      const mockResult = {
        items: [
          {
            candidate: { id: "user-1", applicantProfileId: 10, email: "carlos@example.com" },
            similarity: 0.88,
            knnRank: 1,
          },
        ],
      };
      vi.mocked(api.get).mockResolvedValueOnce(mockResult as any);

      const result = await taApi.getJobTalentPool(10);
      expect(api.get).toHaveBeenCalledWith("/api/ta/jobs/10/talent-pool");
      expect(result).toEqual(mockResult.items);
    });

    it("retrieves similar talent pool candidates for a source application/candidate", async () => {
      const mockResult = {
        items: [
          {
            candidate: { id: "user-2", applicantProfileId: 20, email: "maria@example.com" },
            similarity: 0.85,
            knnRank: 1,
          },
        ],
      };
      vi.mocked(api.get).mockResolvedValueOnce(mockResult as any);

      const result = await taApi.getSimilarCandidates(5);
      expect(api.get).toHaveBeenCalledWith("/api/ta/candidates/5/similar");
      expect(result).toEqual(mockResult.items);
    });

    it("adds candidate to talent pool", async () => {
      const mockMembership = { id: 1, applicantProfileId: 10, status: "ACTIVE", availability: "AVAILABLE" };
      vi.mocked(api.post).mockResolvedValueOnce(mockMembership as any);

      const result = await taApi.addCandidateToPool({ applicantProfileId: 10, notes: "Strong candidate" });
      expect(api.post).toHaveBeenCalledWith("/api/ta/talent-pool/members", { applicantProfileId: 10, notes: "Strong candidate" });
      expect(result).toEqual(mockMembership);
    });

    it("records talent pool contact outcome with positive jobPostingId", async () => {
      const mockContact = { id: 50, membershipId: 100, jobPostingId: 10, outcome: "INTERESTED" };
      vi.mocked(api.post).mockResolvedValueOnce(mockContact as any);

      const result = await taApi.recordContact({
        membershipId: 100,
        jobPostingId: 10,
        outcome: "INTERESTED",
        notes: "Candidate confirmed interest",
      });
      expect(api.post).toHaveBeenCalledWith("/api/ta/talent-pool/contacts", {
        membershipId: 100,
        jobPostingId: 10,
        outcome: "INTERESTED",
        notes: "Candidate confirmed interest",
      });
      expect(result).toEqual(mockContact);
    });

    it("reactivates candidate into new job application via considerCandidateForJob", async () => {
      const mockReactivation = {
        success: true,
        message: "Candidate reactivated into a new job application successfully",
        application: { id: 250, jobPostingId: 10, status: "SUBMITTED" },
        contact: { id: 50, outcome: "INTERESTED" },
        score: { finalFitScore: 91 },
      };
      vi.mocked(api.post).mockResolvedValueOnce(mockReactivation as any);

      const result = await taApi.considerCandidateForJob({
        applicantProfileId: 10,
        targetJobId: 10,
        notes: "Reactivating for Warehouse Lead",
        contactOutcome: "INTERESTED",
      });
      expect(api.post).toHaveBeenCalledWith("/api/ta/talent-pool/consider", {
        applicantProfileId: 10,
        targetJobId: 10,
        notes: "Reactivating for Warehouse Lead",
        contactOutcome: "INTERESTED",
      });
      expect(result).toEqual(mockReactivation);
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
