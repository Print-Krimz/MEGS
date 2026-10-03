import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configuration: vi.fn(), maximum: vi.fn(), pages: vi.fn(), profile: vi.fn(), score: vi.fn(), rebuild: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: {
  candidateScoringConfiguration: { findUniqueOrThrow: mocks.configuration, findFirstOrThrow: mocks.configuration, findFirst: mocks.configuration },
  application: { findFirst: mocks.maximum, findMany: mocks.pages },
  applicantProfile: { findUnique: mocks.profile },
} }));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../src/utils/notification.js", () => ({ sendRoleNotification: vi.fn() }));
vi.mock("../../src/services/scoring/candidate-scoring.service.js", () => ({ calculateAndPersistCandidateScore: mocks.score }));
vi.mock("../../src/services/scoring/talent-pool-knn.service.js", () => ({ rebuildCandidateFeatureProfile: mocks.rebuild }));
import { revalidateJobScoring, revalidateApplication, revalidateApplicantProfile, trackOperation, waitForRevalidationQueueToIdle } from "../../src/services/scoring/scoring-configuration.service.js";

describe("paged scoring revalidation compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.configuration.mockResolvedValue({ id: 7, version: 4 }); mocks.maximum.mockResolvedValue({ id: 205 });
    mocks.score.mockResolvedValue(undefined); mocks.rebuild.mockResolvedValue(undefined); mocks.profile.mockResolvedValue({ id: 1, userId: "owner" });
    mocks.pages.mockImplementation(async ({ where, take }) => Array.from({ length: 205 }, (_, i) => ({ id: i + 1, jobPostingId: 9 })).filter(row => row.id > where.id.gt && row.id <= where.id.lte).slice(0, take));
  });
  it("pages large jobs, preserves configuration IDs and returns the admitted count", async () => {
    expect(await revalidateJobScoring(9)).toBe(205);
    await waitForRevalidationQueueToIdle();
    expect(mocks.pages).toHaveBeenCalledTimes(3); expect(mocks.score).toHaveBeenCalledTimes(205);
    expect(mocks.pages.mock.calls.map(([query]) => query.where.id.gt)).toEqual([0, 100, 200]);
    for (const [query] of mocks.pages.mock.calls) { expect(query.take).toBe(100); expect(query.where.id.lte).toBe(205); expect(query.where.jobPostingId).toBe(9); }
    expect(mocks.score.mock.calls[0][3]).toEqual({ forceNewCalculation: true, configurationId: 7 });
  });
  it("individual revalidation still resolves only after scoring finishes", async () => {
    let release!: () => void;
    mocks.score.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
    let resolved = false;
    const operation = revalidateApplication(1, 9).then(() => { resolved = true; });
    await new Promise(resolve => setTimeout(resolve, 5)); expect(resolved).toBe(false);
    release(); await operation; expect(resolved).toBe(true);
  });
  it("profile recalculation pages only the owner's nonarchived applications", async () => {
    await revalidateApplicantProfile(1); await waitForRevalidationQueueToIdle();
    expect(mocks.rebuild).toHaveBeenCalledWith(1);
    expect(mocks.profile.mock.calls[0][0].select.user).toBeUndefined();
    expect(mocks.pages.mock.calls[0][0].where).toMatchObject({ userId: "owner", isArchived: false });
  });
  it("operation bookkeeping handles rejection without an unhandled finally promise", async () => {
    const rejected = Promise.reject(new Error("synthetic bookkeeping failure"));
    trackOperation(rejected); await expect(rejected).rejects.toThrow();
    await waitForRevalidationQueueToIdle();
  });
});
