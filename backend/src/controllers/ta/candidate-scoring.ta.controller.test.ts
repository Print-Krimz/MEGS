import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flags: {
    dynamicCandidateScoringEnabled: vi.fn(),
    knnTalentPoolingEnabled: vi.fn(),
  },
  discover: vi.fn(),
  similar: vi.fn(),
  search: vi.fn(),
  addToPool: vi.fn(),
  recordContact: vi.fn(),
  consider: vi.fn(),
  ranked: vi.fn(),
  enqueue: vi.fn().mockResolvedValue(undefined),
  audit: vi.fn(),
}));

vi.mock("../../utils/scoring-flags.js", () => ({ scoringFlags: mocks.flags }));
vi.mock("../../services/scoring/talent-pool-knn.service.js", () => ({
  discoverTalentPoolForJob: mocks.discover,
  findSimilarCandidates: mocks.similar,
  searchTalentPoolByText: mocks.search,
  addToTalentPool: mocks.addToPool,
  recordTalentPoolContact: mocks.recordContact,
  considerTalentPoolCandidateForJob: mocks.consider,
  InvalidKnnRequestError: class InvalidKnnRequestError extends Error {},
}));
vi.mock("../../services/scoring/candidate-scoring.service.js", () => ({ listRankedCandidates: mocks.ranked }));
vi.mock("../../services/scoring/scoring-configuration.service.js", () => ({ revalidateJobScoring: mocks.enqueue }));
vi.mock("../../utils/audit.js", () => ({ logAudit: mocks.audit }));

import {
  addCandidateToPool,
  considerCandidateForJob,
  getTalentPool,
  recordContact,
  searchTalentPool,
} from "./candidate-scoring.ta.controller.js";

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

  it("adds candidate to talent pool and returns 201 with audit log", async () => {
    const membership = { id: 1, applicantProfileId: 10, status: "ACTIVE", availability: "AVAILABLE" };
    mocks.addToPool.mockResolvedValueOnce(membership);
    const res = response();

    await addCandidateToPool(
      {
        body: { applicantProfileId: 10, availability: "AVAILABLE", notes: "Great potential" },
        user: { id: "ta-1" },
      } as any,
      res as any
    );

    expect(mocks.addToPool).toHaveBeenCalledWith({
      applicantProfileId: 10,
      availability: "AVAILABLE",
      notes: "Great potential",
      addedById: "ta-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: membership }));
    expect(mocks.audit).toHaveBeenCalledWith("ta-1", "TALENT_POOL_MEMBER_ADDED", "ApplicantProfile", 10, {});
  });

  it("records contact with candidate and returns 201 with audit log", async () => {
    const contact = { id: 5, membershipId: 1, jobPostingId: 8, outcome: "INTERESTED" };
    mocks.recordContact.mockResolvedValueOnce(contact);
    const res = response();

    await recordContact(
      {
        body: { membershipId: 1, jobPostingId: 8, outcome: "INTERESTED", notes: "Reached out via LinkedIn" },
        user: { id: "ta-1" },
      } as any,
      res as any
    );

    expect(mocks.recordContact).toHaveBeenCalledWith({
      membershipId: 1,
      jobPostingId: 8,
      outcome: "INTERESTED",
      notes: "Reached out via LinkedIn",
      recruiterId: "ta-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mocks.audit).toHaveBeenCalledWith(
      "ta-1",
      "TALENT_POOL_CONTACT_LOGGED",
      "TalentPoolMembership",
      1,
      { outcome: "INTERESTED" }
    );
  });

  it("reactivates candidate via considerCandidateForJob and returns 201 with audit log", async () => {
    const reactivationResult = {
      message: "Candidate reactivated into a new job application successfully",
      application: { id: 250, jobPostingId: 8, userId: "user-10" },
      contact: { id: 10, outcome: "INTERESTED" },
      score: { finalFitScore: 88 },
    };
    mocks.consider.mockResolvedValueOnce(reactivationResult);
    const res = response();

    await considerCandidateForJob(
      {
        body: { applicantProfileId: 10, targetJobId: 8, notes: "Confirmed interest" },
        user: { id: "ta-1" },
      } as any,
      res as any
    );

    expect(mocks.consider).toHaveBeenCalledWith({
      applicantProfileId: 10,
      targetJobId: 8,
      notes: "Confirmed interest",
      recruiterId: "ta-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mocks.audit).toHaveBeenCalledWith(
      "ta-1",
      "TALENT_POOL_REACTIVATION",
      "Application",
      250,
      { targetJobId: 8 }
    );
  });
});
