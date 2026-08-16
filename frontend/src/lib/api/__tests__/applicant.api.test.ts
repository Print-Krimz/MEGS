import { describe, it, expect, vi, beforeEach } from "vitest";
import { applicantApi } from "../applicant.api";
import { applicantJobsApi } from "../applicant-jobs.api";
import { api } from "../client";

vi.mock("../client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

describe("Applicant APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("applicantApi", () => {
    it("fetches applicant profile", async () => {
      const mockProfile = { id: 1, firstName: "Juan", lastName: "Dela Cruz" };
      vi.mocked(api.get).mockResolvedValueOnce(mockProfile as any);

      const result = await applicantApi.getProfile();
      expect(api.get).toHaveBeenCalledWith("/api/applicants/profile");
      expect(result).toEqual(mockProfile);
    });

    it("upserts profile personal details", async () => {
      const payload = { firstName: "Juan", lastName: "Dela Cruz", mobileNumber: "09171234567" };
      vi.mocked(api.post).mockResolvedValueOnce({ ...payload, id: 1 } as any);

      const result = await applicantApi.upsertProfile(payload);
      expect(api.post).toHaveBeenCalledWith("/api/applicants/profile", payload);
      expect(result).toHaveProperty("id", 1);
    });

    it("adds and deletes work experience", async () => {
      const expPayload = {
        roleTitle: "Security Lead",
        company: "Guard Corp",
        startDate: "2020-01-01",
        isCurrent: true,
      };
      vi.mocked(api.post).mockResolvedValueOnce({ ...expPayload, id: 10 } as any);
      vi.mocked(api.delete).mockResolvedValueOnce(null as any);

      const created = await applicantApi.addWorkExperience(expPayload);
      expect(api.post).toHaveBeenCalledWith("/api/applicants/profile/work-experience", {
        company: "Guard Corp",
        title: "Security Lead",
        roleTitle: "Security Lead",
        startDate: "2020-01-01",
        endDate: undefined,
        isCurrent: true,
        description: undefined,
        summary: undefined,
      });
      expect(created).toHaveProperty("id", 10);

      await applicantApi.deleteWorkExperience(10);
      expect(api.delete).toHaveBeenCalledWith("/api/applicants/profile/work-experience/10");
    });

    it("updates applicant skills array", async () => {
      const skills = ["First Aid", "CCTV Monitoring", "Fire Safety"];
      vi.mocked(api.post).mockResolvedValueOnce({ skills } as any);

      const result = await applicantApi.updateSkills(skills);
      expect(api.post).toHaveBeenCalledWith("/api/applicants/profile/skills", { skills });
      expect(result).toEqual({ skills });
    });
  });

  describe("applicantJobsApi", () => {
    it("fetches open jobs with search parameters", async () => {
      const mockJobs = [{ id: 1, title: "Warehouse Guard", location: "Laguna" }];
      vi.mocked(api.get).mockResolvedValueOnce(mockJobs as any);

      const result = await applicantJobsApi.getJobs({ search: "guard", location: "Laguna" });
      expect(api.get).toHaveBeenCalledWith("/api/applicant-jobs/jobs?search=guard&location=Laguna");
      expect(result).toEqual(mockJobs);
    });

    it("fetches job details by id", async () => {
      const mockDetail = { id: 1, title: "Warehouse Guard", alreadyApplied: false };
      vi.mocked(api.get).mockResolvedValueOnce(mockDetail as any);

      const result = await applicantJobsApi.getJobDetail(1);
      expect(api.get).toHaveBeenCalledWith("/api/applicant-jobs/jobs/1");
      expect(result).toEqual(mockDetail);
    });

    it("fetches candidate submitted applications", async () => {
      const mockApplications = [{ id: 1, jobPostingId: 1, status: "SUBMITTED" }];
      vi.mocked(api.get).mockResolvedValueOnce(mockApplications as any);

      const result = await applicantJobsApi.getMyApplications();
      expect(api.get).toHaveBeenCalledWith("/api/applicant-jobs/my-applications");
      expect(result).toEqual(mockApplications);
    });

    it("fetches single application details by id with interviews and compliance", async () => {
      const mockApplication = {
        id: 244,
        jobPostingId: 10,
        status: "INITIAL_SCREENING",
        interviews: [{ id: 1, type: "INITIAL_SCREENING", scheduledAt: "2026-08-15T10:35:00Z" }],
      };
      vi.mocked(api.get).mockResolvedValueOnce(mockApplication as any);

      const result = await applicantJobsApi.getApplicationDetail(244);
      expect(api.get).toHaveBeenCalledWith("/api/applicant-jobs/applications/244");
      expect(result).toEqual(mockApplication);
    });
  });
});
