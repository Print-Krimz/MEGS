import { describe, expect, it, vi, beforeEach } from "vitest";
import { DEFAULT_KNN_SETTINGS, DEFAULT_WEIGHTS } from "./scoring-configuration.service.js";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    application: { findMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    applicantProfile: { findUniqueOrThrow: vi.fn() },
    candidateScoringConfiguration: { findUniqueOrThrow: vi.fn(), findFirstOrThrow: vi.fn(), findFirst: vi.fn() },
    scoringRevalidationTask: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
  audit: vi.fn(),
  candidateScoringService: {
    calculateAndPersistCandidateScore: vi.fn(),
  },
  talentPoolKnnService: {
    rebuildCandidateFeatureProfile: vi.fn(),
  },
}));

vi.mock("../../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../../utils/audit.js", () => ({ logAudit: mocks.audit }));
vi.mock("./candidate-scoring.service.js", () => mocks.candidateScoringService);
vi.mock("./talent-pool-knn.service.js", () => mocks.talentPoolKnnService);

import {
  updateScoringConfiguration,
  revalidateConfiguration,
  revalidateApplicantProfile,
  getScoringRevalidationStatus,
  waitForRevalidationQueueToIdle,
} from "./scoring-configuration.service.js";

describe("scoring configuration activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
          matchThreshold: 75,
          weights: Object.entries(DEFAULT_WEIGHTS).map(([dimension, weight]) => ({ dimension, weight })),
        }),
      },
      candidateScore: { updateMany: vi.fn().mockResolvedValue({ count: 4 }) },
    };
    mocks.prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.prisma.candidateScoringConfiguration.findUniqueOrThrow.mockResolvedValue({ id: 2, version: 2 });
    mocks.prisma.application.findMany.mockResolvedValue([]);

    await expect(updateScoringConfiguration("admin-1", 1, { weights: DEFAULT_WEIGHTS, knnSettings: DEFAULT_KNN_SETTINGS, matchThreshold: 75 }))
      .resolves.toMatchObject({ id: 2, version: 2, status: "ACTIVE", matchThreshold: 75 });

    expect(tx.candidateScore.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { configurationId: 1, status: "CALCULATED" },
      data: expect.objectContaining({ status: "STALE", staleAt: expect.any(Date) }),
    }));
    expect(mocks.audit).toHaveBeenCalledWith("admin-1", "CANDIDATE_SCORING_CONFIGURATION_ACTIVATED", "CandidateScoringConfiguration", 2, { version: 2 });
  });

  it("persists revalidation tasks in database and updates status to COMPLETED on success", async () => {
    mocks.prisma.candidateScoringConfiguration.findUniqueOrThrow.mockResolvedValue({ id: 2, version: 2 });
    mocks.prisma.application.findMany.mockResolvedValue([
      { id: 101, jobPostingId: 201, userId: "u-1", user: { applicantProfile: { id: 501 } } },
    ]);
    mocks.prisma.scoringRevalidationTask.upsert.mockResolvedValue({
      id: "task-101",
      dedupeKey: "CONFIG-2-APP-101",
      status: "PENDING",
    });
    mocks.prisma.scoringRevalidationTask.findUnique.mockResolvedValue({
      id: "task-101",
      status: "PENDING",
    });
    mocks.prisma.scoringRevalidationTask.update.mockResolvedValue({
      id: "task-101",
      status: "COMPLETED",
    });
    mocks.candidateScoringService.calculateAndPersistCandidateScore.mockResolvedValue({
      id: 99,
      finalFitScore: 88,
    });

    await revalidateConfiguration(2);
    await waitForRevalidationQueueToIdle();

    expect(mocks.prisma.scoringRevalidationTask.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupeKey: "CONFIG-2-APP-101" },
      create: expect.objectContaining({
        target: "CONFIGURATION",
        configurationId: 2,
        configurationVersion: 2,
        applicationId: 101,
        jobPostingId: 201,
        applicantProfileId: 501,
        status: "PENDING",
      }),
    }));

    // Task transitioned to PROCESSING and then COMPLETED
    expect(mocks.prisma.scoringRevalidationTask.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "task-101" },
      data: expect.objectContaining({ status: "PROCESSING" }),
    }));
    expect(mocks.prisma.scoringRevalidationTask.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "task-101" },
      data: expect.objectContaining({ status: "COMPLETED", completedAt: expect.any(Date) }),
    }));
  });

  it("marks task as FAILED and records error message when scoring calculation fails", async () => {
    mocks.prisma.candidateScoringConfiguration.findUniqueOrThrow.mockResolvedValue({ id: 2, version: 2 });
    mocks.prisma.application.findMany.mockResolvedValue([
      { id: 102, jobPostingId: 202, userId: "u-2", user: { applicantProfile: { id: 502 } } },
    ]);
    mocks.prisma.scoringRevalidationTask.upsert.mockResolvedValue({
      id: "task-102",
      dedupeKey: "CONFIG-2-APP-102",
      status: "PENDING",
    });
    mocks.prisma.scoringRevalidationTask.findUnique.mockResolvedValue({
      id: "task-102",
      status: "PENDING",
    });
    mocks.prisma.scoringRevalidationTask.update.mockResolvedValue({
      id: "task-102",
      status: "FAILED",
    });
    mocks.candidateScoringService.calculateAndPersistCandidateScore.mockRejectedValue(
      new Error("Candidate profile is missing mandatory skills")
    );

    await revalidateConfiguration(2);
    await waitForRevalidationQueueToIdle();

    expect(mocks.prisma.scoringRevalidationTask.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "task-102" },
      data: expect.objectContaining({
        status: "FAILED",
        lastError: expect.stringContaining("Candidate profile is missing mandatory skills"),
      }),
    }));
  });

  it("retrieves real database counts and formatted failure details for reassessment queue", async () => {
    mocks.prisma.scoringRevalidationTask.groupBy.mockResolvedValue([
      { status: "PENDING", _count: { _all: 3 } },
      { status: "PROCESSING", _count: { _all: 1 } },
      { status: "COMPLETED", _count: { _all: 45 } },
      { status: "FAILED", _count: { _all: 2 } },
    ]);

    mocks.prisma.scoringRevalidationTask.findMany.mockResolvedValue([
      {
        id: "task-uuid-failed-1",
        target: "APPLICATION",
        applicationId: 101,
        attempts: 2,
        lastError: "Invalid feature schema version",
        application: {
          id: 101,
          jobPosting: { title: "Senior Logistics Officer" },
          user: {
            email: "john@example.com",
            applicantProfile: { firstName: "John", lastName: "Doe" },
          },
        },
      },
    ]);

    const status = await getScoringRevalidationStatus();

    expect(status.counts).toEqual({
      PENDING: 3,
      PROCESSING: 1,
      COMPLETED: 45,
      FAILED: 2,
    });

    expect(status.failures).toHaveLength(1);
    expect(status.failures[0]).toEqual({
      id: "task-uui",
      target: "Application #101 (John Doe - Senior Logistics Officer)",
      lastError: "Invalid feature schema version",
      attempts: 2,
    });
  });
});

