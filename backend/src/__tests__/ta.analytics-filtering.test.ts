import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../utils/prisma.js";
import {
  extractTAFilters,
  getTAPipelineFunnelHandler,
} from "../controllers/ta/ta.analytics.controller.js";
import {
  parseDateRange,
  getTAOverviewStats,
  getRecruitmentActivityTrend,
} from "../services/analytics/analytics.service.js";

// Mock Prisma client for deterministic query verification
vi.mock("../utils/prisma.js", () => ({
  default: {
    application: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    interview: {
      findMany: vi.fn(),
    },
    clientEndorsement: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    recruiterDecision: {
      findMany: vi.fn(),
    },
    deployment: {
      findMany: vi.fn(),
    },
    talentPoolMembership: {
      count: vi.fn(),
    },
  },
}));

describe("TA Analytics Recruiter Filtering & Weekly Default Time Horizon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. extractTAFilters", () => {
    it("extracts recruiterId when provided in query parameters", () => {
      const query = {
        recruiterId: "recruiter-uuid-456",
        range: "7d",
        clientId: "5",
        mrfId: "12",
        jobPostingId: "34",
        stage: "INITIAL_SCREENING",
        mineOnly: "false",
      };

      const filters = extractTAFilters(query);

      expect(filters.recruiterId).toBe("recruiter-uuid-456");
      expect(filters.range).toBe("7d");
      expect(filters.clientId).toBe(5);
      expect(filters.mrfId).toBe(12);
      expect(filters.jobPostingId).toBe(34);
      expect(filters.stage).toBe("INITIAL_SCREENING");
      expect(filters.mineOnly).toBe(false);
    });

    it("returns undefined for recruiterId when query parameter is omitted or empty", () => {
      const queryWithoutRecruiter = { range: "7d" };
      const filters1 = extractTAFilters(queryWithoutRecruiter);
      expect(filters1.recruiterId).toBeUndefined();

      const queryWithEmptyRecruiter = { recruiterId: "" };
      const filters2 = extractTAFilters(queryWithEmptyRecruiter);
      expect(filters2.recruiterId).toBeUndefined();
    });

    it("correctly sets mineOnly boolean flag", () => {
      expect(extractTAFilters({ mineOnly: "true" }).mineOnly).toBe(true);
      expect(extractTAFilters({ mineOnly: true }).mineOnly).toBe(true);
      expect(extractTAFilters({ mineOnly: "false" }).mineOnly).toBe(false);
      expect(extractTAFilters({}).mineOnly).toBe(false);
    });
  });

  describe("2. parseDateRange weekly default (7d)", () => {
    it("defaults to 7 days when range is omitted", () => {
      const result = parseDateRange({});

      expect(result.days).toBe(7);
      expect(result.dateKeys.length).toBe(7);
      const diffDays = Math.round((result.end.getTime() - result.start.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it("defaults to 7 days when range is empty or undefined in filters", () => {
      const result = parseDateRange({ range: undefined });

      expect(result.days).toBe(7);
      expect(result.dateKeys.length).toBe(7);
    });

    it("returns 7 days explicitly when range is '7d'", () => {
      const result = parseDateRange({ range: "7d" });

      expect(result.days).toBe(7);
      expect(result.dateKeys.length).toBe(7);
    });

    it("supports '30d' when explicitly requested and yields 30 days", () => {
      const result = parseDateRange({ range: "30d" });

      expect(result.days).toBe(30);
      expect(result.dateKeys.length).toBe(30);
    });

    it("supports '90d' when explicitly requested and yields 90 days", () => {
      const result = parseDateRange({ range: "90d" });

      expect(result.days).toBe(90);
      expect(result.dateKeys.length).toBe(90);
    });

    it("supports custom date range", () => {
      const result = parseDateRange({
        range: "custom",
        startDate: "2026-09-01T00:00:00",
        endDate: "2026-09-05T23:59:59",
      });

      expect(result.days).toBe(5);
      expect(result.dateKeys.length).toBe(5);
    });
  });

  describe("3. Database Query Scoping with recruiterId", () => {
    it("scopes getTAOverviewStats queries to the specified recruiterId", async () => {
      vi.mocked(prisma.application.count).mockResolvedValue(5);
      vi.mocked(prisma.clientEndorsement.count).mockResolvedValue(2);

      const targetRecruiterId = "recruiter-target-001";
      const stats = await getTAOverviewStats("logged-in-ta-id", {
        recruiterId: targetRecruiterId,
      });

      expect(stats.myActiveApplications).toBe(5);

      // Verify that prisma.application.count was called with jobPosting: { postedById: targetRecruiterId }
      expect(prisma.application.count).toHaveBeenCalled();
      const appCalls = vi.mocked(prisma.application.count).mock.calls;

      // Check first count query (Active Applications)
      expect(appCalls[0][0]?.where?.jobPosting).toEqual({
        postedById: targetRecruiterId,
      });

      // Check endorsement query incorporates the job posting postedById
      const endoCall = vi.mocked(prisma.clientEndorsement.count).mock.calls[0][0];
      expect(endoCall?.where?.application?.jobPosting).toEqual({
        postedById: targetRecruiterId,
      });
    });

    it("scopes getRecruitmentActivityTrend queries to the specified recruiterId even with userScope", async () => {
      vi.mocked(prisma.application.findMany).mockResolvedValue([]);
      vi.mocked(prisma.interview.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientEndorsement.findMany).mockResolvedValue([]);
      vi.mocked(prisma.recruiterDecision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.deployment.findMany).mockResolvedValue([]);

      const targetRecruiterId = "recruiter-target-002";
      await getRecruitmentActivityTrend(
        { recruiterId: targetRecruiterId, range: "7d" },
        { role: "TALENT_ACQUISITION", userId: "logged-in-ta-id" }
      );

      // Verify application.findMany received recruiter's ID in jobClause
      expect(prisma.application.findMany).toHaveBeenCalled();
      const appArgs = vi.mocked(prisma.application.findMany).mock.calls[0][0];
      expect(appArgs?.where?.jobPosting?.postedById).toBe(targetRecruiterId);

      // Verify interview.findMany checked application.jobPosting.postedById
      expect(prisma.interview.findMany).toHaveBeenCalled();
      const interviewArgs = vi.mocked(prisma.interview.findMany).mock.calls[0][0];
      expect(interviewArgs?.where?.application?.jobPosting?.postedById).toBe(targetRecruiterId);

      // Verify clientEndorsement.findMany includes endorsedById constraint for recruiterId
      expect(prisma.clientEndorsement.findMany).toHaveBeenCalled();
      const endoArgs = vi.mocked(prisma.clientEndorsement.findMany).mock.calls[0][0];
      expect(endoArgs?.where?.OR).toContainEqual({ endorsedById: targetRecruiterId });

      // Verify deployment.findMany includes createdById constraint for recruiterId
      expect(prisma.deployment.findMany).toHaveBeenCalled();
      const depArgs = vi.mocked(prisma.deployment.findMany).mock.calls[0][0];
      expect(depArgs?.where?.OR).toContainEqual({ createdById: targetRecruiterId });
    });

    it("scopes getTAPipelineFunnelHandler query to recruiterId and sends success response", async () => {
      const targetRecruiterId = "recruiter-target-003";
      vi.mocked(prisma.application.findMany).mockResolvedValue([
        { id: 1, status: "SUBMITTED", recruiterDecisions: [] },
        { id: 2, status: "INITIAL_SCREENING", recruiterDecisions: [] },
      ] as any);

      const req: any = {
        query: {
          recruiterId: targetRecruiterId,
        },
        user: {
          id: "logged-in-ta-id",
          role: "TALENT_ACQUISITION",
        },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      await getTAPipelineFunnelHandler(req, res);

      // Verify application.findMany was filtered by recruiterId
      expect(prisma.application.findMany).toHaveBeenCalled();
      const funnelCallArgs = vi.mocked(prisma.application.findMany).mock.calls[0][0];
      expect(funnelCallArgs?.where?.jobPosting?.postedById).toBe(targetRecruiterId);

      // Verify success response was sent
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "TA pipeline funnel analytics retrieved",
          data: expect.objectContaining({
            totalApplications: 2,
          }),
        })
      );
    });

    it("prefers logged-in user ID in getTAPipelineFunnelHandler when mineOnly is true", async () => {
      vi.mocked(prisma.application.findMany).mockResolvedValue([]);

      const req: any = {
        query: {
          recruiterId: "other-recruiter-id",
          mineOnly: "true",
        },
        user: {
          id: "my-ta-user-id",
          role: "TALENT_ACQUISITION",
        },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      await getTAPipelineFunnelHandler(req, res);

      expect(prisma.application.findMany).toHaveBeenCalled();
      const callArgs = vi.mocked(prisma.application.findMany).mock.calls[0][0];
      expect(callArgs?.where?.jobPosting?.postedById).toBe("my-ta-user-id");
    });
  });
});
