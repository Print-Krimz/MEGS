import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    application: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    recruiterDecision: { groupBy: vi.fn() },
    deployment: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
  dynamicScoring: vi.fn(),
  activeConfig: vi.fn(),
}));

vi.mock("../../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../../utils/scoring-flags.js", () => ({ scoringFlags: { dynamicCandidateScoringEnabled: mocks.dynamicScoring } }));
vi.mock("../scoring/scoring-configuration.service.js", () => ({ getActiveScoringConfiguration: mocks.activeConfig }));
vi.mock("../document/document.service.js", () => ({
  resolveDocumentSignedUrl: vi.fn(),
  resolveDocumentSignedUrls: vi.fn().mockResolvedValue([]),
  uploadAndStoreDocument: vi.fn(),
}));
vi.mock("../../utils/notification.js", () => ({ notifyJobOwner: vi.fn(), notifyOwner: vi.fn(), sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
vi.mock("../../utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../scoring/talent-pool-knn.service.js", () => ({ rebuildCandidateFeatureProfile: vi.fn() }));

import { listTAApplications } from "./ta.applications.service.js";

const row = (id: number) => ({
  id,
  status: "SUBMITTED",
  aiScore: null,
  isArchived: false,
  createdAt: new Date(2026, 0, id),
  jobPosting: null,
  user: { id: `u${id}`, email: `u${id}@x.test`, applicantProfile: null },
  _count: { interviews: 0, recruiterDecisions: 0, complianceRequirements: 0 },
});

type SqlLike = { strings: readonly string[]; values: unknown[] };
const isSql = (value: unknown): value is SqlLike => typeof value === "object" && value !== null && "strings" in value && "values" in value;
/** Expands nested Prisma.sql fragments into one SQL string with "?" placeholders and a flat value list. */
const flatten = (strings: readonly string[], values: unknown[]): { sql: string; values: unknown[] } => {
  let sql = strings[0];
  const flat: unknown[] = [];
  values.forEach((value, index) => {
    if (isSql(value)) {
      const inner = flatten(value.strings, value.values);
      sql += inner.sql;
      flat.push(...inner.values);
    } else {
      sql += "?";
      flat.push(value);
    }
    sql += strings[index + 1];
  });
  return { sql, values: flat };
};

/** The ranking statement is the $queryRaw call whose SQL orders applications (the other one reads scores). */
const rankingCall = () => {
  for (const [strings, ...values] of mocks.prisma.$queryRaw.mock.calls) {
    const flat = flatten(strings as string[], values);
    if (flat.sql.includes("ORDER BY COALESCE")) return { ...flat, sql: flat.sql.replace(/\s+/g, " ") };
  }
  throw new Error("no ranking query");
};

describe("best match ranks across all candidates before paging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dynamicScoring.mockReturnValue(false);
    mocks.activeConfig.mockResolvedValue(null);
    mocks.prisma.application.count.mockResolvedValue(60);
    mocks.prisma.recruiterDecision.groupBy.mockResolvedValue([]);
    mocks.prisma.deployment.findMany.mockResolvedValue([]);
  });

  it("selects the page in SQL: the oldest high-score candidate leads page 1 and page 2 offsets past it", async () => {
    const everyone = Array.from({ length: 60 }, (_, i) => ({ id: i + 1 }));
    mocks.prisma.application.findMany
      .mockResolvedValueOnce(everyone)
      .mockResolvedValueOnce([row(2), row(1), row(3)]);
    // Application 1 is the oldest and holds the best score; SQL returns it first.
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]).mockResolvedValue([]);

    const result = await listTAApplications({ summary: true, page: 1, limit: 3 });

    expect(result.items.map((item: any) => item.id)).toEqual([1, 2, 3]);
    expect(result.total).toBe(60);
    const { sql, values } = rankingCall();
    // The whole filtered id set feeds the ranking; the cut is LIMIT/OFFSET in the database.
    expect(values[0]).toBe(-1);
    expect(values).toContainEqual(everyone.map((entry) => entry.id));
    expect(sql).toContain("LIMIT ? OFFSET ?");
    expect(values.slice(-2)).toEqual([3, 0]);

    mocks.prisma.application.findMany.mockResolvedValueOnce(everyone).mockResolvedValueOnce([row(4)]);
    mocks.prisma.$queryRaw.mockReset();
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ id: 4 }]).mockResolvedValue([]);
    await listTAApplications({ summary: true, page: 2, limit: 3 });
    expect(rankingCall().values.slice(-2)).toEqual([3, 3]);
  });

  it("orders by the preferred score with newest and id ties, and loads only page rows", async () => {
    mocks.activeConfig.mockResolvedValue({ id: 7, version: 3 });
    mocks.dynamicScoring.mockReturnValue(true);
    mocks.prisma.application.findMany.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([row(1)]);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValue([]);

    await listTAApplications({ summary: true, page: 1, limit: 10 });

    const { sql, values } = rankingCall();
    // Active configuration's CALCULATED score first, then newest calculation (stale scores still rank), then id.
    expect(values[0]).toBe(7);
    expect(sql).toContain(`score."configurationId" = ? AND score."status" = 'CALCULATED' THEN 0 ELSE 1 END`);
    expect(sql).toContain(`score."calculatedAt" DESC, score."id" DESC`);
    // Missing scores sort last (dynamic mode has no aiScore fallback), then createdAt and id break ties.
    expect(sql).toContain(`ORDER BY COALESCE(preferred."finalFitScore", -1) DESC, application."createdAt" DESC, application."id" DESC`);
    expect(mocks.prisma.application.findMany.mock.calls[1][0]).toMatchObject({ where: { id: { in: [1] } } });
  });

  it("keeps the aiScore fallback when dynamic scoring is off", async () => {
    mocks.prisma.application.findMany.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([row(1)]);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValue([]);
    await listTAApplications({ summary: true, page: 1, limit: 10 });
    expect(rankingCall().sql).toContain(`COALESCE(preferred."finalFitScore", COALESCE(application."aiScore", -1)) DESC`);
  });

  it("builds the candidate id set from the owner-scoped filter, so other TAs' rows never rank", async () => {
    mocks.prisma.application.findMany.mockResolvedValueOnce([{ id: 5 }]).mockResolvedValueOnce([row(5)]);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ id: 5 }]).mockResolvedValue([]);
    await listTAApplications({ summary: true, actor: { id: "ta-1", role: "TALENT_ACQUISITION" } as any, source: "WALK_IN", search: "ana" });
    const idQuery = mocks.prisma.application.findMany.mock.calls[0][0];
    expect(idQuery.select).toEqual({ id: true });
    const text = JSON.stringify(idQuery.where);
    expect(text).toContain("ta-1");
    expect(text).toContain("WALK_IN");
    expect(text).toContain("ana");
    expect(idQuery.where).toEqual(expect.objectContaining({ AND: expect.any(Array) }));
    expect(mocks.prisma.application.count.mock.calls[0][0].where).toEqual(idQuery.where);
  });

  it("returns an empty page without running the ranking query when nothing matches", async () => {
    mocks.prisma.application.findMany.mockResolvedValueOnce([]);
    mocks.prisma.application.count.mockResolvedValue(0);
    const result = await listTAApplications({ summary: true, page: 1, limit: 10 });
    expect(result.items).toEqual([]);
    expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("ranks the legacy list the same way before its page cut", async () => {
    mocks.prisma.application.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]).mockResolvedValueOnce([
      { ...row(2), candidateScores: [], complianceRequirements: [], jobPosting: { id: 1, mrf: null } },
      { ...row(1), candidateScores: [], complianceRequirements: [], jobPosting: { id: 1, mrf: null } },
    ]);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]).mockResolvedValue([]);
    const result: any = await listTAApplications({ page: 1, limit: 2 });
    expect(result.data.map((item: any) => item.id)).toEqual([1, 2]);
    expect(rankingCall().values.slice(-2)).toEqual([2, 0]);
  });
});
