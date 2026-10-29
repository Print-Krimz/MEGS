import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withProviderRetry } from "../../src/security/provider-retry.js";
const db = vi.hoisted(() => ({ find: vi.fn(), document: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
  download: vi.fn(), analyze: vi.fn(), categorize: vi.fn(), score: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: {
  application: { findUnique: db.find, update: db.update, updateMany: db.updateMany }, storedDocument: { findUnique: db.document }, candidateScore: { findFirst: db.score },
} }));
vi.mock("../../src/utils/supabase.js", () => ({ default: { storage: { from: () => ({ download: db.download }) } } }));
vi.mock("../../src/middleware/upload.middleware.js", () => ({ ensureBucketExists: vi.fn() }));
vi.mock("../../src/utils/gemini.js", () => ({ analyzeResume: db.analyze, analyzeResumeFromBuffer: db.analyze }));
vi.mock("../../src/utils/notification.js", () => ({ sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
vi.mock("../../src/security/document-parser.js", () => ({ extractDocumentText: vi.fn().mockResolvedValue("Synthetic candidate resume with sufficiently long experience and education for parsing.") }));
vi.mock("../../src/services/ta/ta.applications.service.js", () => ({ applyScoreCategorization: db.categorize }));
import { extractDocumentText } from "../../src/security/document-parser.js";
import { enqueueResumeAnalysis, waitForResumeQueue, getQueueStatus } from "../../src/workers/resume.worker.js";

describe("resume automation past the 20th and 21st resumes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractDocumentText).mockResolvedValue("Synthetic candidate resume with sufficiently long experience and education for parsing.");
    db.find.mockImplementation(async ({ where }) => ({ id: where.id, userId: "owner", status: "PARSING",
      resumeUrl: "/api/documents/1/download", jobPosting: { title: "Engineer", requirements: "Skills", postedById: "staff" } }));
    db.document.mockResolvedValue({ id: 1, ownerId: "owner", sizeBytes: 20, storageBucket: "documents", storagePath: "owner/resume.pdf", mimeType: "application/pdf", originalName: "resume.pdf" });
    db.download.mockResolvedValue({ data: new Blob(["%PDF-1.4\n%%EOF"]), error: null });
    db.update.mockResolvedValue({}); db.updateMany.mockResolvedValue({ count: 1 }); db.categorize.mockResolvedValue({}); db.score.mockResolvedValue(null);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
  it("completes 50 resumes, recovers provider throttling, deduplicates admission, and writes each score once", async () => {
    vi.useFakeTimers();
    const upstream = vi.fn().mockResolvedValue({ score: 80, summary: "Synthetic fit", strengths: ["Skills"], gaps: [], requirements: [] });
    let analyzed = 0;
    db.analyze.mockImplementation(async () => {
      analyzed++;
      if (analyzed === 21) upstream.mockRejectedValueOnce({ status: 429, headers: { "retry-after": "1" } });
      return withProviderRetry(upstream);
    });
    const admissions = Promise.all(Array.from({ length: 50 }, (_, i) => enqueueResumeAnalysis(i + 1)));
    // Duplicate the same admitted work while it is still queued/running.
    await enqueueResumeAnalysis(21);
    await vi.advanceTimersByTimeAsync(10_000);
    await admissions; await waitForResumeQueue();
    expect(db.update).toHaveBeenCalledTimes(50); expect(db.categorize).toHaveBeenCalledTimes(50);
    const ids = db.update.mock.calls.map(([arg]) => arg.where.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(db.update.mock.calls.every(([arg]) => arg.data.aiScore === 80)).toBe(true);
    expect(upstream).toHaveBeenCalledTimes(51);
    expect(getQueueStatus()).toEqual({ size: 0, pending: 0 });
  });
  it("keeps persistent provider failures visible and recoverable by retrying the same record", async () => {
    db.analyze.mockRejectedValue(new Error("quota exhausted"));
    await enqueueResumeAnalysis(77); await waitForResumeQueue();
    expect(db.updateMany.mock.calls[0]![0].data.status).toBe("NEEDS_ATTENTION");
    expect(db.categorize).not.toHaveBeenCalled();
    db.analyze.mockResolvedValue({ score: 70, summary: "Recovered", strengths: [], gaps: [], requirements: [] });
    await enqueueResumeAnalysis(77); await waitForResumeQueue();
    expect(db.update.mock.calls[0]![0]).toMatchObject({ where: { id: 77 }, data: { aiScore: 70 } });
    expect(db.categorize).toHaveBeenCalledTimes(1);
  });
});
