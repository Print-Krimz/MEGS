import { describe, expect, it, vi } from "vitest";
import { DEFAULT_KNN_SETTINGS, DEFAULT_WEIGHTS } from "./scoring-configuration.service.js";

const mocks = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn(), application: { findMany: vi.fn().mockResolvedValue([]) } },
  audit: vi.fn(),
}));

vi.mock("../../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../../utils/audit.js", () => ({ logAudit: mocks.audit }));
import { updateScoringConfiguration } from "./scoring-configuration.service.js";

describe("scoring configuration activation", () => {
  it("marks old calculations stale before queueing asynchronous revalidation", async () => {
    const tx = {
      candidateScoringConfiguration: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, revision: 1, weights: [] }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        aggregate: vi.fn().mockResolvedValue({ _max: { version: 1 } }),
        create: vi.fn().mockResolvedValue({
          id: 2,
          scope: "GLOBAL",
          status: "ACTIVE",
          version: 2,
          revision: 1,
          knnSettings: DEFAULT_KNN_SETTINGS,
          weights: Object.entries(DEFAULT_WEIGHTS).map(([dimension, weight]) => ({ dimension, weight })),
        }),
      },
      candidateScore: { updateMany: vi.fn().mockResolvedValue({ count: 4 }) },
    };
    mocks.prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(updateScoringConfiguration("admin-1", 1, { weights: DEFAULT_WEIGHTS, knnSettings: DEFAULT_KNN_SETTINGS }))
      .resolves.toMatchObject({ id: 2, version: 2, status: "ACTIVE" });

    expect(tx.candidateScore.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { configurationId: 1, status: "CALCULATED" },
      data: expect.objectContaining({ status: "STALE", staleAt: expect.any(Date) }),
    }));
    expect(mocks.audit).toHaveBeenCalledWith("admin-1", "CANDIDATE_SCORING_CONFIGURATION_ACTIVATED", "CandidateScoringConfiguration", 2, { version: 2 });
  });
});
