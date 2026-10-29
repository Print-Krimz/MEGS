import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    application: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
  enqueueResumeAnalysis: vi.fn(),
  trackFitRevalidation: vi.fn(),
  getQueueStatus: vi.fn(() => ({ size: 0, pending: 0 })),
  revalidateApplication: vi.fn().mockResolvedValue(undefined),
  updateTAApplicationStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../../workers/resume.worker.js", () => ({
  enqueueResumeAnalysis: mocks.enqueueResumeAnalysis,
  getQueueStatus: mocks.getQueueStatus,
  trackFitRevalidation: mocks.trackFitRevalidation,
}));
vi.mock("../scoring/scoring-configuration.service.js", () => ({
  revalidateApplication: mocks.revalidateApplication,
}));
vi.mock("./ta.applications.service.js", () => ({
  updateTAApplicationStatus: mocks.updateTAApplicationStatus,
}));

import { queueApplicationAnalysis } from "./ta.ai.service.js";

describe("TA AI Service - Refresh AI Analysis on Active Applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows refreshing AI score for applications in INITIAL_SCREENING without demoting pipeline status", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 152,
      status: "INITIAL_SCREENING",
      resumeUrl: "/api/documents/3/download",
      isArchived: false,
      jobPostingId: 10,
    });

    const result = await queueApplicationAnalysis(152);

    expect(result).toMatchObject({
      applicationId: 152,
      status: "INITIAL_SCREENING",
    });
    expect(mocks.updateTAApplicationStatus).not.toHaveBeenCalled();
    expect(mocks.enqueueResumeAnalysis).toHaveBeenCalledWith(152);
    expect(mocks.revalidateApplication).toHaveBeenCalledWith(152, 10);
  });

  it("allows refreshing AI score for applications in FINAL_INTERVIEW stage", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 155,
      status: "FINAL_INTERVIEW",
      resumeUrl: "/api/documents/5/download",
      isArchived: false,
      jobPostingId: 12,
    });

    const result = await queueApplicationAnalysis(155);

    expect(result.status).toBe("FINAL_INTERVIEW");
    expect(mocks.updateTAApplicationStatus).not.toHaveBeenCalled();
    expect(mocks.enqueueResumeAnalysis).toHaveBeenCalledWith(155);
  });

  it("transitions SUBMITTED applications to PARSING when queued", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 156,
      status: "SUBMITTED",
      resumeUrl: "/api/documents/6/download",
      isArchived: false,
      jobPostingId: 14,
    });

    const result = await queueApplicationAnalysis(156);

    expect(result.status).toBe("PARSING");
    expect(mocks.updateTAApplicationStatus).toHaveBeenCalledWith(156, "PARSING", undefined, "Queued for AI resume parsing", undefined, { notifyApplicant: false });
    expect(mocks.enqueueResumeAnalysis).toHaveBeenCalledWith(156);
  });

  it("restores the retryable status only while the row is still PARSING when the queue refuses work", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 157, status: "NEEDS_ATTENTION", resumeUrl: "/api/documents/7/download", isArchived: false, jobPostingId: 15,
    });
    mocks.enqueueResumeAnalysis.mockRejectedValueOnce(new Error("queue closed"));

    await expect(queueApplicationAnalysis(157)).rejects.toThrow("queue closed");

    expect(mocks.prisma.application.updateMany).toHaveBeenCalledWith({
      where: { id: 157, status: "PARSING" },
      data: { status: "NEEDS_ATTENTION" },
    });
  });
});
