import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    application: { count: vi.fn(), findMany: vi.fn() },
    recruiterDecision: { groupBy: vi.fn() },
    deployment: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("../../../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../../../utils/scoring-flags.js", () => ({
  scoringFlags: { dynamicCandidateScoringEnabled: () => false },
}));
vi.mock("../../scoring/scoring-configuration.service.js", () => ({
  getActiveScoringConfiguration: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../document/document.service.js", () => ({
  resolveDocumentSignedUrl: vi.fn(),
  resolveDocumentSignedUrls: vi.fn(),
  uploadAndStoreDocument: vi.fn(),
}));
vi.mock("../../../utils/notification.js", () => ({ notifyJobOwner: vi.fn(async () => 0), notifyOwner: vi.fn(async () => 0), sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
vi.mock("../../../utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../scoring/talent-pool-knn.service.js", () => ({ rebuildCandidateFeatureProfile: vi.fn() }));

import { listTAApplications } from "../ta.applications.service.js";
import { stageEnteredAt } from "../../analytics/metric-definitions.js";

const day = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * day - 60_000);

const row = (id: number, createdAt: Date, status = "INITIAL_SCREENING") => ({
  id,
  status,
  aiScore: null,
  isArchived: false,
  createdAt,
  jobPosting: null,
  user: { id: `u${id}`, email: `u${id}@x.test`, applicantProfile: null },
  _count: { interviews: 0, recruiterDecisions: 0, complianceRequirements: 0 },
});

describe("TA application list sorting and needs-action filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.application.count.mockResolvedValue(3);
    mocks.prisma.recruiterDecision.groupBy.mockResolvedValue([]);
    mocks.prisma.deployment.findMany.mockResolvedValue([]);
    mocks.prisma.$queryRaw.mockResolvedValue([]);
  });

  it("ranks the default list by effective score in SQL before paging", async () => {
    mocks.prisma.application.findMany
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([row(2, daysAgo(2)), row(1, daysAgo(1))]);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ id: 2 }, { id: 1 }]);
    const result = await listTAApplications({ summary: true });
    expect(mocks.prisma.application.findMany.mock.calls[1][0].where).toEqual({ id: { in: [2, 1] } });
    expect(result.items.map((i: any) => i.id)).toEqual([2, 1]);
  });

  it("orders newest first by created date with an id tie-break", async () => {
    mocks.prisma.application.findMany.mockResolvedValue([]);
    await listTAApplications({ summary: true, sort: "newest" });
    expect(mocks.prisma.application.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("orders oldest first by created date with an id tie-break", async () => {
    mocks.prisma.application.findMany.mockResolvedValue([]);
    await listTAApplications({ summary: true, sort: "oldest" });
    expect(mocks.prisma.application.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
  });

  it("does not re-sort by score when a sort is chosen", async () => {
    mocks.prisma.application.findMany.mockResolvedValue([
      { ...row(1, daysAgo(1)), aiScore: 10 },
      { ...row(2, daysAgo(2)), aiScore: 90 },
    ]);
    const result = await listTAApplications({ summary: true, sort: "newest" });
    expect(result.items.map((i: any) => i.id)).toEqual([1, 2]);
  });

  it("ranks longest in stage first and pages across the whole set", async () => {
    mocks.prisma.application.findMany
      .mockResolvedValueOnce([
        { id: 1, status: "INITIAL_SCREENING", createdAt: daysAgo(30) },
        { id: 2, status: "INITIAL_SCREENING", createdAt: daysAgo(20) },
        { id: 3, status: "INITIAL_SCREENING", createdAt: daysAgo(10) },
      ])
      .mockResolvedValueOnce([row(3, daysAgo(10)), row(1, daysAgo(30))]);
    // App 1 only just entered screening, so app 3 and app 2 have waited longer.
    mocks.prisma.recruiterDecision.groupBy.mockResolvedValue([
      { applicationId: 1, toStatus: "INITIAL_SCREENING", _max: { createdAt: daysAgo(1) } },
    ]);

    const result = await listTAApplications({ summary: true, sort: "waiting", page: 1, limit: 2 });

    // Order by stage entry: 2 (20d), 3 (10d), 1 (1d). First page of two is [2, 3].
    const pageQuery = mocks.prisma.application.findMany.mock.calls[1][0];
    expect(pageQuery.where).toEqual({ id: { in: [2, 3] } });
    expect(mocks.prisma.application.findMany.mock.calls[0][0].take).toBe(5000);
    expect(result.total).toBe(3);
  });

  it("returns waiting rows in rank order with stage fields", async () => {
    mocks.prisma.application.findMany
      .mockResolvedValueOnce([
        { id: 1, status: "SUBMITTED", createdAt: daysAgo(3) },
        { id: 2, status: "SUBMITTED", createdAt: daysAgo(9) },
      ])
      .mockResolvedValueOnce([row(1, daysAgo(3), "SUBMITTED"), row(2, daysAgo(9), "SUBMITTED")]);
    const result = await listTAApplications({ summary: true, sort: "waiting" });
    expect(result.items.map((i: any) => i.id)).toEqual([2, 1]);
    expect(result.items[0].daysInStage).toBe(9);
    expect(typeof result.items[0].stageEnteredAt).toBe("string");
  });

  it("adds days in stage to default list items from one grouped query", async () => {
    mocks.prisma.application.findMany.mockResolvedValue([row(5, daysAgo(40))]);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ id: 5 }]);
    mocks.prisma.recruiterDecision.groupBy.mockResolvedValue([
      { applicationId: 5, toStatus: "INITIAL_SCREENING", _max: { createdAt: daysAgo(4) } },
    ]);
    const result = await listTAApplications({ summary: true });
    expect(mocks.prisma.recruiterDecision.groupBy).toHaveBeenCalledTimes(1);
    expect(result.items[0].daysInStage).toBe(4);
  });

  it("restricts to applications with a pending step when needsAction is set", async () => {
    mocks.prisma.application.findMany.mockResolvedValue([]);
    await listTAApplications({ summary: true, needsAction: true });
    const conditions = mocks.prisma.application.findMany.mock.calls[0][0].where.AND;
    const needs = conditions.find((c: any) => Array.isArray(c.OR) && c.status);
    expect(needs.isArchived).toBe(false);
    expect(needs.status).toEqual({ notIn: ["BACKOUT", "REJECTED", "ARCHIVED", "TALENT_POOL", "HIRED"] });
    expect(needs.OR).toEqual(expect.arrayContaining([
      { status: "SUBMITTED" },
      { status: "CONTRACT_SIGNING" },
      { clientEndorsements: { some: { outcome: "PENDING" } } },
      { complianceRequirements: { some: { reviewStatus: "SUBMITTED" } } },
      { deployments: { some: { status: "READY_FOR_DEPLOYMENT" } } },
    ]));
  });

  it("adds no needs-action condition by default", async () => {
    mocks.prisma.application.findMany.mockResolvedValue([]);
    await listTAApplications({ summary: true });
    const conditions = mocks.prisma.application.findMany.mock.calls[0][0].where.AND;
    expect(conditions.some((c: any) => Array.isArray(c.OR) && c.status)).toBe(false);
  });
});

describe("waiting sort scales without per-row filtering", () => {
  // Previous implementation, kept as the oracle: filters the whole entries array once per row.
  type Entry = { applicationId: number; toStatus: string; createdAt: Date };
  const oldEntryFor = (entries: Entry[], applicationId: number, status: string, createdAt: Date): Date =>
    stageEnteredAt(
      entries.filter((e) => e.applicationId === applicationId).map((e) => ({ fromStatus: "", toStatus: e.toStatus, createdAt: e.createdAt, isReverted: false })),
      status,
      createdAt,
    );

  it("waiting sort output identical to previous implementation for 200 rows x 1000 entries", async () => {
    const statuses = ["SUBMITTED", "INITIAL_SCREENING", "INTERVIEW", "COMPLIANCE"];
    const base = Date.UTC(2026, 0, 1);
    let seed = 42;
    const rand = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    // Few distinct dates so ties are common and the id tie-break is exercised.
    const candidates = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      status: statuses[rand(statuses.length)],
      createdAt: new Date(base + rand(8) * day),
    }));
    const entries: Entry[] = [];
    for (const c of candidates) {
      for (let k = 0; k < 5; k++) {
        entries.push({ applicationId: c.id, toStatus: k === 0 ? c.status : statuses[rand(statuses.length)], createdAt: new Date(base + rand(8) * day) });
      }
    }
    expect(entries).toHaveLength(1000);
    const expected = candidates
      .map((c) => ({ id: c.id, at: oldEntryFor(entries, c.id, c.status, c.createdAt) }))
      .sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id)
      .map((c) => c.id);

    mocks.prisma.application.count.mockResolvedValue(200);
    mocks.prisma.recruiterDecision.groupBy.mockResolvedValue(
      entries.map((e) => ({ applicationId: e.applicationId, toStatus: e.toStatus, _max: { createdAt: e.createdAt } })),
    );
    mocks.prisma.application.findMany
      .mockResolvedValueOnce(candidates)
      .mockImplementationOnce(async (args: any) => args.where.id.in.map((id: number) => row(id, new Date(base))));
    const result = await listTAApplications({ summary: true, sort: "waiting", page: 1, limit: 200 });
    expect(result.items.map((i: any) => i.id)).toEqual(expected);
  });
});
