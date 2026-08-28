import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../utils/prisma.js";
import {
  getRecruitmentActivityTrend,
  getAdminOverviewStats,
  getAdminFunnelAnalytics,
  getAdminBottlenecks,
  getApplicationsByJobAndMRF,
  getTAOverviewStats,
  getTAPendingActions,
  getAnalyticsFilterOptions,
} from "./analytics.service.js";

// Mock prisma for deterministic testing of analytics aggregation logic
vi.mock("../../utils/prisma.js", () => ({
  default: {
    application: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    interview: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    clientEndorsement: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    complianceRequirement: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    deployment: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    deploymentStatusHistory: {
      findMany: vi.fn(),
    },
    employmentEvent: {
      findMany: vi.fn(),
    },
    recruiterDecision: {
      findMany: vi.fn(),
    },
    talentPoolMembership: {
      count: vi.fn(),
    },
    jobPosting: {
      findMany: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
    },
    manpowerRequest: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

describe("Analytics Service - Unit & Aggregation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRecruitmentActivityTrend", () => {
    it("generates contiguous daily series for a 7-day date range", async () => {
      const now = new Date("2026-08-20T12:00:00Z");
      vi.setSystemTime(now);

      vi.mocked(prisma.application.findMany).mockResolvedValueOnce([
        { id: 1, createdAt: new Date("2026-08-19T08:00:00Z") },
        { id: 2, createdAt: new Date("2026-08-19T10:00:00Z") },
        { id: 3, createdAt: new Date("2026-08-20T09:00:00Z") },
      ] as any);

      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([
        { id: 1, type: "INITIAL_SCREENING", conductedAt: new Date("2026-08-18T14:00:00Z"), createdAt: new Date("2026-08-18T00:00:00Z") },
        { id: 2, type: "FINAL_INTERVIEW", conductedAt: new Date("2026-08-20T11:00:00Z"), createdAt: new Date("2026-08-20T00:00:00Z") },
      ] as any);

      vi.mocked(prisma.clientEndorsement.findMany).mockResolvedValueOnce([
        { id: 1, createdAt: new Date("2026-08-19T16:00:00Z") },
      ] as any);

      vi.mocked(prisma.recruiterDecision.findMany).mockResolvedValueOnce([
        { id: 1, toStatus: "COMPLIANCE", createdAt: new Date("2026-08-20T15:00:00Z") },
      ] as any);

      vi.mocked(prisma.deployment.findMany).mockResolvedValueOnce([
        { id: 1, createdAt: new Date("2026-08-20T16:00:00Z") },
      ] as any);

      const result = await getRecruitmentActivityTrend({ range: "7d" });

      expect(result.series).toBeDefined();
      expect(result.series.length).toBe(7);
      expect(result.totals.applicationsReceived).toBe(3);
      expect(result.totals.initialInterviewsCompleted).toBe(1);
      expect(result.totals.clientEndorsements).toBe(1);
      expect(result.totals.finalInterviewsCompleted).toBe(1);
      expect(result.totals.candidatesMovedToCompliance).toBe(1);
      expect(result.totals.candidatesDeployed).toBe(1);

      vi.useRealTimers();
    });

    it("correctly scopes queries to TA specialist when userScope is provided", async () => {
      vi.mocked(prisma.application.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.clientEndorsement.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.recruiterDecision.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.deployment.findMany).mockResolvedValueOnce([]);

      await getRecruitmentActivityTrend(
        { range: "30d" },
        { role: "TALENT_ACQUISITION", userId: "ta-user-123" }
      );

      // Verify that query parameters include the TA's user ID constraint
      expect(prisma.application.findMany).toHaveBeenCalled();
      const appCallArgs = vi.mocked(prisma.application.findMany).mock.calls[0][0];
      expect(appCallArgs?.where?.jobPosting?.postedById).toBe("ta-user-123");
    });
  });

  describe("getAdminOverviewStats", () => {
    it("returns correct system-wide KPI totals matching database counts", async () => {
      vi.mocked(prisma.application.count)
        .mockResolvedValueOnce(120) // Total Applications
        .mockResolvedValueOnce(75)  // Active Candidates
        .mockResolvedValueOnce(12); // In Compliance

      vi.mocked(prisma.talentPoolMembership.count).mockResolvedValueOnce(30);
      vi.mocked(prisma.clientEndorsement.count).mockResolvedValueOnce(45);
      vi.mocked(prisma.deployment.count).mockResolvedValueOnce(18);

      const stats = await getAdminOverviewStats({});

      expect(stats.totalApplications).toBe(120);
      expect(stats.activeCandidates).toBe(75);
      expect(stats.talentPoolCandidates).toBe(30);
      expect(stats.clientEndorsements).toBe(45);
      expect(stats.candidatesInCompliance).toBe(12);
      expect(stats.totalDeployments).toBe(18);
    });
  });

  describe("getAdminFunnelAnalytics", () => {
    it("calculates accurate conversion rates across the canonical 6 recruitment stages", async () => {
      vi.mocked(prisma.application.findMany).mockResolvedValueOnce([
        { id: 1, status: "SUBMITTED", recruiterDecisions: [] },
        { id: 2, status: "INITIAL_SCREENING", recruiterDecisions: [{ toStatus: "INITIAL_SCREENING" }] },
        { id: 3, status: "CLIENT_ENDORSEMENT", recruiterDecisions: [{ toStatus: "INITIAL_SCREENING" }, { toStatus: "CLIENT_ENDORSEMENT" }] },
        { id: 4, status: "FINAL_INTERVIEW", recruiterDecisions: [{ toStatus: "INITIAL_SCREENING" }, { toStatus: "CLIENT_ENDORSEMENT" }, { toStatus: "FINAL_INTERVIEW" }] },
        { id: 5, status: "COMPLIANCE", recruiterDecisions: [{ toStatus: "INITIAL_SCREENING" }, { toStatus: "CLIENT_ENDORSEMENT" }, { toStatus: "FINAL_INTERVIEW" }, { toStatus: "COMPLIANCE" }] },
        { id: 6, status: "DEPLOYED", recruiterDecisions: [{ toStatus: "INITIAL_SCREENING" }, { toStatus: "CLIENT_ENDORSEMENT" }, { toStatus: "FINAL_INTERVIEW" }, { toStatus: "COMPLIANCE" }, { toStatus: "DEPLOYED" }] },
      ] as any);

      const funnel = await getAdminFunnelAnalytics({});

      expect(funnel.stages).toHaveLength(6);
      expect(funnel.stages[0].stage).toBe("APPLICATIONS");
      expect(funnel.stages[0].count).toBe(6);
      expect(funnel.stages[5].stage).toBe("DEPLOYED");
      expect(funnel.stages[5].count).toBe(1);
    });
  });

  describe("getAdminBottlenecks", () => {
    it("detects candidate aging across pipeline stages and flags overdue SLA", async () => {
      const now = new Date("2026-08-20T12:00:00Z");
      vi.setSystemTime(now);

      vi.mocked(prisma.application.findMany).mockResolvedValueOnce([
        // Stage: INITIAL_SCREENING (10 days old -> overdue)
        {
          id: 10,
          status: "INITIAL_SCREENING",
          createdAt: new Date("2026-08-10T12:00:00Z"),
          updatedAt: new Date("2026-08-10T12:00:00Z"),
          interviews: [],
          clientEndorsements: [],
          complianceRequirements: [],
        },
        // Stage: INITIAL_SCREENING (2 days old -> healthy)
        {
          id: 11,
          status: "INITIAL_SCREENING",
          createdAt: new Date("2026-08-18T12:00:00Z"),
          updatedAt: new Date("2026-08-18T12:00:00Z"),
          interviews: [],
          clientEndorsements: [],
          complianceRequirements: [],
        },
      ] as any);

      const bottlenecks = await getAdminBottlenecks({});

      expect(bottlenecks.length).toBeGreaterThan(0);
      const screeningBottleneck = bottlenecks.find((b) => b.stageKey === "INITIAL_SCREENING");
      expect(screeningBottleneck).toBeDefined();
      expect(screeningBottleneck?.candidateCount).toBe(2);
      expect(screeningBottleneck?.overdueCount).toBe(1);

      vi.useRealTimers();
    });
  });

  describe("getTAOverviewStats", () => {
    it("returns workload counts scoped to the logged-in TA", async () => {
      vi.mocked(prisma.application.count)
        .mockResolvedValueOnce(25) // My Active Applications
        .mockResolvedValueOnce(8)  // Initial Interviews Pending
        .mockResolvedValueOnce(4)  // Ready for Endorsement
        .mockResolvedValueOnce(3)  // Final Interviews Pending
        .mockResolvedValueOnce(5); // Awaiting Compliance

      vi.mocked(prisma.clientEndorsement.count).mockResolvedValueOnce(6); // Pending Client Decisions

      const stats = await getTAOverviewStats("ta-user-1", {});

      expect(stats.myActiveApplications).toBe(25);
      expect(stats.initialInterviewsPending).toBe(8);
      expect(stats.readyForEndorsement).toBe(4);
      expect(stats.pendingClientDecisions).toBe(6);
      expect(stats.finalInterviewsPending).toBe(3);
      expect(stats.awaitingCompliance).toBe(5);
    });
  });

  describe("getTAPendingActions", () => {
    it("returns actionable items with navigation links for TA specialist", async () => {
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([
        {
          id: 101,
          type: "INITIAL_SCREENING",
          scheduledAt: new Date("2026-08-15T00:00:00Z"),
          complianceDeadline: new Date("2026-08-18T00:00:00Z"),
          application: {
            id: 201,
            user: { applicantProfile: { firstName: "Juan", lastName: "Cruz" } },
            jobPosting: { title: "Welder" },
          },
        },
      ] as any);

      vi.mocked(prisma.clientEndorsement.findMany).mockResolvedValueOnce([
        {
          id: 301,
          outcome: "PENDING",
          createdAt: new Date("2026-08-16T00:00:00Z"),
          application: {
            id: 202,
            user: { applicantProfile: { firstName: "Pedro", lastName: "Santos" } },
            jobPosting: { title: "Electrician" },
          },
          client: { name: "Acme Corp" },
        },
      ] as any);

      vi.mocked(prisma.complianceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 401,
          documentLabel: "NBI Clearance",
          reviewStatus: "SUBMITTED",
          application: {
            id: 203,
            user: { applicantProfile: { firstName: "Maria", lastName: "Reyes" } },
            jobPosting: { title: "Assembler" },
          },
        },
      ] as any);

      const actions = await getTAPendingActions("ta-user-1", {});

      expect(actions.length).toBe(3);
      expect(actions[0].targetUrl).toBeDefined();
      expect(actions[0].candidateName).toBe("Juan Cruz");
    });
  });

  describe("getAnalyticsFilterOptions", () => {
    it("returns populated dropdown options for clients, MRFs, jobs, and recruiters", async () => {
      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([
        { id: 1, name: "Acme Corp" },
      ] as any);

      vi.mocked(prisma.manpowerRequest.findMany).mockResolvedValueOnce([
        { id: 10, title: "10x Welders", clientId: 1 },
      ] as any);

      vi.mocked(prisma.jobPosting.findMany).mockResolvedValueOnce([
        { id: 100, title: "Senior Welder", mrfId: 10, postedById: "ta-1" },
      ] as any);

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { id: "ta-1", email: "ta@megs.ph", role: "TALENT_ACQUISITION", applicantProfile: { firstName: "Jane", lastName: "Doe" } },
      ] as any);

      const options = await getAnalyticsFilterOptions("ADMINISTRATOR");

      expect(options.clients).toHaveLength(1);
      expect(options.mrfs).toHaveLength(1);
      expect(options.jobPostings).toHaveLength(1);
      expect(options.recruiters).toHaveLength(1);
      expect(options.stages.length).toBeGreaterThan(0);
    });
  });

  describe("Cascading & Combined MRF -> Job -> Stage Filtering", () => {
    it("applies MRF, Job Posting, and Stage filters across all activity sub-queries", async () => {
      vi.mocked(prisma.application.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.clientEndorsement.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.recruiterDecision.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.deployment.findMany).mockResolvedValueOnce([]);

      await getRecruitmentActivityTrend({
        mrfId: 10,
        jobPostingId: 100,
        stage: "INITIAL_SCREENING",
        range: "30d",
      });

      // 1. Application query
      expect(prisma.application.findMany).toHaveBeenCalled();
      const appWhere = vi.mocked(prisma.application.findMany).mock.calls[0][0]?.where;
      expect(appWhere?.jobPostingId).toBe(100);
      expect(appWhere?.jobPosting?.mrfId).toBe(10);
      expect(appWhere?.status).toBe("INITIAL_SCREENING");

      // 2. Endorsement query
      expect(prisma.clientEndorsement.findMany).toHaveBeenCalled();
      const endoWhere = vi.mocked(prisma.clientEndorsement.findMany).mock.calls[0][0]?.where;
      expect(endoWhere?.application?.jobPostingId).toBe(100);
      expect(endoWhere?.application?.jobPosting?.mrfId).toBe(10);

      // 3. Deployment query
      expect(prisma.deployment.findMany).toHaveBeenCalled();
      const depWhere = vi.mocked(prisma.deployment.findMany).mock.calls[0][0]?.where;
      expect(depWhere?.mrfId).toBe(10);
      expect(depWhere?.application?.jobPostingId).toBe(100);
    });

    it("applies MRF and Job Posting filters to Admin Overview endorsements and deployments", async () => {
      vi.mocked(prisma.application.count).mockResolvedValue(10);
      vi.mocked(prisma.talentPoolMembership.count).mockResolvedValue(5);
      vi.mocked(prisma.clientEndorsement.count).mockResolvedValue(4);
      vi.mocked(prisma.deployment.count).mockResolvedValue(2);

      await getAdminOverviewStats({
        mrfId: 10,
        jobPostingId: 100,
        stage: "INITIAL_SCREENING",
      });

      // Verify Endorsement query args
      const endoArgs = vi.mocked(prisma.clientEndorsement.count).mock.calls[0][0]?.where;
      expect(endoArgs?.application?.jobPostingId).toBe(100);
      expect(endoArgs?.application?.jobPosting?.mrfId).toBe(10);

      // Verify Deployment query args
      const depArgs = vi.mocked(prisma.deployment.count).mock.calls[0][0]?.where;
      expect(depArgs?.mrfId).toBe(10);
      expect(depArgs?.application?.jobPostingId).toBe(100);
    });

    it("filters bottlenecks by stage when stage filter is provided", async () => {
      const now = new Date("2026-08-20T12:00:00Z");
      vi.setSystemTime(now);

      vi.mocked(prisma.application.findMany).mockResolvedValueOnce([
        {
          id: 10,
          status: "INITIAL_SCREENING",
          createdAt: new Date("2026-08-10T12:00:00Z"),
          updatedAt: new Date("2026-08-10T12:00:00Z"),
          interviews: [],
          clientEndorsements: [],
          complianceRequirements: [],
        },
      ] as any);

      const bottlenecks = await getAdminBottlenecks({
        stage: "INITIAL_SCREENING",
        mrfId: 10,
      });

      // Bottlenecks list should only contain the requested stage or highlight it
      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].stageKey).toBe("INITIAL_SCREENING");
      expect(bottlenecks[0].candidateCount).toBe(1);

      vi.useRealTimers();
    });

    it("filters TA pending actions by specific stage", async () => {
      vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([
        {
          id: 101,
          type: "INITIAL_SCREENING",
          scheduledAt: new Date("2026-08-15T00:00:00Z"),
          complianceDeadline: new Date("2026-08-18T00:00:00Z"),
          application: {
            id: 201,
            user: { applicantProfile: { firstName: "Juan", lastName: "Cruz" } },
            jobPosting: { title: "Welder" },
          },
        },
      ] as any);

      // When stage is INITIAL_SCREENING, it should only return interview action items
      const actions = await getTAPendingActions("ta-user-1", {
        stage: "INITIAL_SCREENING",
      });

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("INITIAL_INTERVIEW");
    });
  });
});

