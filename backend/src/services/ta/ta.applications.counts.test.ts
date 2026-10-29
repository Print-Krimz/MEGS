import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    application: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("../../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../../utils/scoring-flags.js", () => ({ scoringFlags: { dynamicCandidateScoringEnabled: () => false } }));
vi.mock("../scoring/scoring-configuration.service.js", () => ({ getActiveScoringConfiguration: vi.fn() }));
vi.mock("../document/document.service.js", () => ({ resolveDocumentSignedUrl: vi.fn(), resolveDocumentSignedUrls: vi.fn(), uploadAndStoreDocument: vi.fn() }));
vi.mock("../../utils/notification.js", () => ({ notifyJobOwner: vi.fn(), notifyOwner: vi.fn(), sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
vi.mock("../../utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../scoring/talent-pool-knn.service.js", () => ({ rebuildCandidateFeatureProfile: vi.fn() }));

import { countTAApplications, listTAApplications } from "./ta.applications.service.js";

const ta = { id: "ta-1", role: "TALENT_ACQUISITION" } as any;

describe("TA application stage counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.application.groupBy.mockResolvedValue([
      { status: "SUBMITTED", _count: { _all: 4 } },
      { status: "COMPLIANCE", _count: { _all: 2 } },
    ]);
    mocks.prisma.$queryRaw.mockResolvedValue([]);
  });

  it("returns the total and a count per status from one grouped query", async () => {
    const counts = await countTAApplications({ actor: ta });
    expect(counts).toEqual({ total: 6, byStatus: { SUBMITTED: 4, COMPLIANCE: 2 } });
    expect(mocks.prisma.application.groupBy).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.application.groupBy.mock.calls[0][0]).toMatchObject({ by: ["status"] });
  });

  it("returns zeros for an empty result", async () => {
    mocks.prisma.application.groupBy.mockResolvedValue([]);
    expect(await countTAApplications({ actor: ta })).toEqual({ total: 0, byStatus: {} });
  });

  it("uses exactly the list's where clause, minus the stage", async () => {
    const filters = { actor: ta, source: "WALK_IN" as const, search: "ana", clientId: 4, jobPostingId: "9", needsAction: true, openOnly: true, isArchived: false };
    mocks.prisma.application.count.mockResolvedValue(0);
    mocks.prisma.application.findMany.mockResolvedValue([]);
    await listTAApplications({ ...filters, summary: true, page: 1, limit: 10 });
    await countTAApplications({ ...filters, status: "SUBMITTED" as any });
    const listWhere = mocks.prisma.application.count.mock.calls[0][0].where;
    expect(mocks.prisma.application.groupBy.mock.calls[0][0].where).toEqual(listWhere);
    expect(JSON.stringify(listWhere)).toContain("ta-1");
  });

  it("keeps ownership and ignores a requested stage", async () => {
    await countTAApplications({ actor: ta, status: "COMPLIANCE" as any });
    const text = JSON.stringify(mocks.prisma.application.groupBy.mock.calls[0][0].where);
    expect(text).toContain("ta-1");
    expect(text).not.toContain("COMPLIANCE");
  });

  it("counts the archived set only when archived rows are requested, and active rows by default", async () => {
    await countTAApplications({ actor: ta, isArchived: true });
    await countTAApplications({ actor: ta });
    const [archived, active] = mocks.prisma.application.groupBy.mock.calls.map(([args]) => JSON.stringify(args.where));
    expect(archived).toContain('"isArchived":true');
    expect(active).toContain('"isArchived":false');
  });

  it("registers the counts route before the by-id routes", () => {
    const routes = readFileSync(new URL("../../routes/ta/ta.routes.ts", import.meta.url), "utf8");
    expect(routes.indexOf('"/applications/counts"')).toBeGreaterThan(-1);
    expect(routes.indexOf('"/applications/counts"')).toBeLessThan(routes.indexOf('"/applications/:id"'));
  });
});
