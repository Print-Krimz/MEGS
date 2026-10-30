import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
  executeRaw: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("../utils/prisma.js", () => ({
  default: {
    application: { updateMany: mocks.updateMany, findMany: mocks.findMany },
    $executeRaw: mocks.executeRaw,
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ $queryRaw: mocks.queryRaw }),
  },
}));
vi.mock("./review-sla.worker.js", () => ({ checkReviewSLABreaches: vi.fn() }));
vi.mock("../services/ta/ta.compliance.service.js", () => ({ generateComplianceRequirementsFromMRF: mocks.generate }));

import { ensureComplianceChecklists, reconcileStaleResumeAnalysis, runScheduledJobs, SCHEDULED_JOBS } from "./scheduled-jobs.js";

describe("scheduled jobs runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("skips every job when another run holds the lock", async () => {
    mocks.queryRaw.mockResolvedValue([{ locked: false }]);
    const job = { name: "a", run: vi.fn() };
    expect(await runScheduledJobs([job])).toEqual({ status: "locked", failedJobs: [] });
    expect(job.run).not.toHaveBeenCalled();
  });

  it("runs every job once it has the lock, even when one fails", async () => {
    mocks.queryRaw.mockResolvedValue([{ locked: true }]);
    const failing = { name: "a", run: vi.fn().mockRejectedValue(new Error("boom")) };
    const next = { name: "b", run: vi.fn().mockResolvedValue({ sent: 0 }) };
    expect(await runScheduledJobs([failing, next])).toEqual({ status: "ran", failedJobs: ["a"] });
    expect(next.run).toHaveBeenCalledTimes(1);
  });
});

describe("stale resume analysis reconciliation", () => {
  it("is registered with the hourly scheduled jobs", () => {
    expect(SCHEDULED_JOBS.map((job) => job.name)).toContain("stale-resume-analysis");
  });

  it("marks only old unfinished initial-stage applications and guards the write with the same conditions", async () => {
    mocks.updateMany.mockResolvedValue({ count: 3 });
    const now = new Date("2026-10-29T10:00:00.000Z");
    await expect(reconcileStaleResumeAnalysis(now)).resolves.toEqual({ staleAnalysisMarked: 3 });
    const [{ where, data }] = mocks.updateMany.mock.calls[0];
    expect(where.updatedAt.lt).toEqual(new Date("2026-10-29T09:30:00.000Z"));
    expect(where).toMatchObject({ isArchived: false, resumeUrl: { not: null }, OR: [{ status: "PARSING" }, { status: "SUBMITTED", aiSummary: null }] });
    // Only these two initial statuses are matched, so advanced stages are never changed.
    expect(JSON.stringify(where)).not.toMatch(/FINAL_INTERVIEW|COMPLIANCE|DEPLOYED|BACKOUT/);
    expect(data).toMatchObject({ status: "NEEDS_ATTENTION" });
  });

  it("leaves a finished SUBMITTED row alone, including one scored by dynamic scoring", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await reconcileStaleResumeAnalysis();
    const [{ where }] = mocks.updateMany.mock.calls[0];
    // A finished analysis always has aiSummary (aiScore too); dynamic scoring adds candidate scores but
    // changes neither, so no SUBMITTED clause may depend on aiScore or candidate scores.
    expect(where.OR).toEqual([{ status: "PARSING" }, { status: "SUBMITTED", aiSummary: null }]);
    expect(JSON.stringify(where)).not.toContain("aiScore");
    expect(JSON.stringify(where)).not.toContain("candidateScores");
  });

  it("is idempotent: a second run finds nothing left to mark", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 0 });
    await reconcileStaleResumeAnalysis();
    await expect(reconcileStaleResumeAnalysis()).resolves.toEqual({ staleAnalysisMarked: 0 });
  });
});

describe("compliance checklist sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.executeRaw.mockResolvedValue(0);
    mocks.generate.mockResolvedValue([]);
  });

  it("is registered with the hourly scheduled jobs", () => {
    expect(SCHEDULED_JOBS.map((job) => job.name)).toContain("compliance-checklists");
  });

  it("compliance-checklists creates checklists for COMPLIANCE apps with none", async () => {
    mocks.findMany.mockResolvedValue([{ id: 5 }]);
    mocks.generate.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await ensureComplianceChecklists();
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { status: "COMPLIANCE", isArchived: false, complianceRequirements: { none: {} } },
      select: { id: true },
      take: 50,
    });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate).toHaveBeenCalledWith(5);
    expect(result).toMatchObject({ checklistsCreated: 1 });
  });

  it("compliance-checklists backfills null deadlines", async () => {
    mocks.executeRaw.mockResolvedValue(4);
    const result = await ensureComplianceChecklists();
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    const [strings] = mocks.executeRaw.mock.calls[0];
    expect(strings.join("")).toContain('"deadline" IS NULL');
    expect(result).toMatchObject({ deadlinesBackfilled: 4 });
  });
});
