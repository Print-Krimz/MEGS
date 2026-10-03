import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ application: vi.fn(), document: vi.fn(), update: vi.fn(), download: vi.fn(), analyze: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: {
  application: { findUnique: mocks.application, update: mocks.update },
  storedDocument: { findUnique: mocks.document },
} }));
vi.mock("../../src/utils/supabase.js", () => ({ default: { storage: { from: () => ({ download: mocks.download }) } } }));
vi.mock("../../src/middleware/upload.middleware.js", () => ({ ensureBucketExists: vi.fn() }));
vi.mock("../../src/utils/gemini.js", () => ({ analyzeResume: mocks.analyze, analyzeResumeFromBuffer: vi.fn() }));
vi.mock("../../src/utils/notification.js", () => ({ sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
vi.mock("../../src/security/document-parser.js", () => ({ extractDocumentText: vi.fn().mockResolvedValue("A valid candidate resume with experience and education sufficiently long for text extraction.") }));
import { processResumeJob, detectDocumentFormat } from "../../src/workers/resume.worker.js";
describe("resume compatibility and safe worker summaries", () => {
  it("uses verified MIME instead of a misleading uploaded filename", () => {
    expect(detectDocumentFormat("image/png", "resume.docx").isImage).toBe(true);
    expect(detectDocumentFormat("image/png", "resume.docx").isDocx).toBe(false);
    expect(detectDocumentFormat("application/pdf", "resume.jpg").isPdf).toBe(true);
  });
  it("accepts generic legacy MIME based on verified bytes and stores only a safe reference on provider failure", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.application.mockResolvedValue({ id: 1, userId: "owner", resumeUrl: "/api/documents/1/download", jobPosting: { title: "Engineer", requirements: "Skills", postedById: "staff" } });
    mocks.document.mockResolvedValue({ id: 1, ownerId: "owner", sizeBytes: 20, storageBucket: "documents", storagePath: "owner/resume.pdf", mimeType: "application/octet-stream", originalName: "resume.pdf" });
    mocks.download.mockResolvedValue({ data: new Blob(["%PDF-1.4\n%%EOF"]), error: null });
    mocks.analyze.mockRejectedValue(new Error("Provider failed https://private.test/?token=FAKE_TOKEN Bearer FAKE_BEARER test.person@example.com"));
    mocks.update.mockResolvedValue({});
    await processResumeJob(1);
    expect(mocks.analyze).toHaveBeenCalled();
    const summary = mocks.update.mock.calls[0][0].data.aiSummary;
    expect(summary).toContain("Manual review required. Reference:");
    expect(mocks.update.mock.calls[0][0].data.status).toBe("NEEDS_ATTENTION");
    const visible = summary + error.mock.calls.flat().join(" ");
    for (const forbidden of ["FAKE_TOKEN", "FAKE_BEARER", "test.person@example.com", "private.test"]) expect(visible).not.toContain(forbidden);
    log.mockRestore(); error.mockRestore();
  });
});
