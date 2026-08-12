import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flags: {
    dynamicCandidateScoringEnabled: vi.fn(),
    knnTalentPoolingEnabled: vi.fn(),
  },
  discover: vi.fn(),
  similar: vi.fn(),
  search: vi.fn(),
  ranked: vi.fn(),
  enqueue: vi.fn().mockResolvedValue(undefined),
  audit: vi.fn(),
}));

vi.mock("../../utils/scoring-flags.js", () => ({ scoringFlags: mocks.flags }));
vi.mock("../../services/scoring/talent-pool-knn.service.js", () => ({
  discoverTalentPoolForJob: mocks.discover,
  findSimilarCandidates: mocks.similar,
  searchTalentPoolByText: mocks.search,
  InvalidKnnRequestError: class InvalidKnnRequestError extends Error {},
}));
vi.mock("../../services/scoring/candidate-scoring.service.js", () => ({ listRankedCandidates: mocks.ranked }));
vi.mock("../../services/scoring/scoring-configuration.service.js", () => ({ revalidateJobScoring: mocks.enqueue }));
vi.mock("../../utils/audit.js", () => ({ logAudit: mocks.audit }));

import { getTalentPool, searchTalentPool } from "./candidate-scoring.ta.controller.js";

const response = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.flags.dynamicCandidateScoringEnabled.mockReturnValue(true);
  mocks.flags.knnTalentPoolingEnabled.mockReturnValue(true);
});

describe("TA talent-pool controller", () => {
  it("does not execute KNN retrieval while its feature flag is disabled", async () => {
    mocks.flags.knnTalentPoolingEnabled.mockReturnValue(false);
    const res = response();

    await getTalentPool({ params: { jobId: "8" }, query: {} } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.discover).not.toHaveBeenCalled();
  });

  it("audits only telemetry for text searches and returns the standard response envelope", async () => {
    const result = { items: [], retrievalOnly: true };
    mocks.search.mockResolvedValueOnce(result);
    const res = response();

    await searchTalentPool({ body: { text: "TypeScript engineers with React" }, user: { id: "ta-1" } } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: result }));
    expect(mocks.audit).toHaveBeenCalledWith("ta-1", "KNN_TALENT_POOL_SEARCH", "TalentPool", null, {});
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("TypeScript engineers");
  });
});
