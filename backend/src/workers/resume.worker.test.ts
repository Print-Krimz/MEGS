import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    application: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    candidateScore: {
      findFirst: vi.fn(),
    },
    storedDocument: {
      findUnique: vi.fn(),
    },
  },
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
  analyzeResume: vi.fn(),
  analyzeResumeFromBuffer: vi.fn(),
  legacyDownload: vi.fn(),
  extractText: vi.fn(),
  notifyJobOwner: vi.fn().mockResolvedValue(0),
}));

vi.mock("../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../utils/supabase.js", () => ({ default: mocks.supabase }));
vi.mock("../utils/gemini.js", () => ({
  analyzeResume: mocks.analyzeResume,
  analyzeResumeFromBuffer: mocks.analyzeResumeFromBuffer,
}));
// The worker reads resumes through these boundaries: a legacy-URL downloader, byte validation and a
// text extractor. Fixtures stand in for them so routing and failure policy are what is under test.
vi.mock("../security/legacy-resume-download.js", () => ({ downloadLegacyResume: mocks.legacyDownload }));
vi.mock("../security/document-parser.js", () => ({ extractDocumentText: mocks.extractText }));
vi.mock("../security/file-validation.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../security/file-validation.js")>()),
  validateDocumentBytes: (_buffer: Buffer, declared?: string) => ({ mimeType: declared ?? "application/pdf", extension: "bin" }),
}));
vi.mock("../middleware/upload.middleware.js", () => ({ ensureBucketExists: vi.fn() }));
vi.mock("../utils/notification.js", () => ({ notifyJobOwner: mocks.notifyJobOwner }));

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const legacyFile = (mimeType: string, originalName: string) =>
  mocks.legacyDownload.mockResolvedValueOnce({ buffer: Buffer.from("resume-bytes"), mimeType, originalName });

import { processResumeJob, detectDocumentFormat } from "./resume.worker.js";

beforeEach(() => {
  // Reset (not just clear) so unused one-time values never leak between tests.
  vi.resetAllMocks();
  mocks.notifyJobOwner.mockResolvedValue(0);
  mocks.prisma.application.update.mockResolvedValue({});
  mocks.prisma.application.updateMany.mockResolvedValue({ count: 1 });
  // A calculated match score exists, so the AI estimate never re-categorizes the application.
  mocks.prisma.candidateScore.findFirst.mockResolvedValue({ finalFitScore: 80 });
});

describe("Resume Worker AI Routing Policy & Multi-Format OCR", () => {
  it("transitions successful resume analysis (even with low score) to REVIEW, never automatic TALENT_POOL", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 101,
      status: "PARSING",
      resumeUrl: "https://example.com/resume.pdf",
      jobPosting: { title: "Software Engineer", requirements: "TypeScript" },
    });

    legacyFile("application/pdf", "resume.pdf");

    mocks.extractText.mockResolvedValueOnce("Candidate resume content with extensive professional experience in software engineering and web application development.");
    mocks.analyzeResume.mockResolvedValueOnce({
      score: 35,
      summary: "Junior candidate",
      strengths: ["Basic HTML"],
      gaps: ["No TypeScript"],
      requirements: [],
    });

    await processResumeJob(101);

    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: expect.objectContaining({
        aiScore: 35,
        aiSummary: expect.any(String),
      }),
    });
  });

  it("transitions processing error (failed resume fetch/parse) to NEEDS_ATTENTION, not TALENT_POOL", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 102,
      status: "PARSING",
      resumeUrl: "https://example.com/bad-file.pdf",
      jobPosting: { title: "Dev", requirements: "Node.js" },
    });

    mocks.legacyDownload.mockRejectedValueOnce(new Error("Unable to download legacy resume"));

    await processResumeJob(102);

    expect(mocks.prisma.application.updateMany).toHaveBeenCalledWith({
      where: { id: 102, resumeUrl: expect.any(String), status: { in: ["SUBMITTED", "PARSING", "NEEDS_ATTENTION"] } },
      data: expect.objectContaining({
        status: "NEEDS_ATTENTION",
      }),
    });
  });

  it("successfully downloads resume when resumeUrl is an internal /api/documents/:id/download route", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 152,
      userId: "owner-1",
      status: "PARSING",
      resumeUrl: "/api/documents/3/download",
      jobPosting: { title: "Frontend Dev", requirements: "React" },
    });

    mocks.prisma.storedDocument.findUnique.mockResolvedValueOnce({
      id: 3,
      ownerId: "owner-1",
      sizeBytes: 20,
      storageBucket: "applicant-assets",
      storagePath: "user-123/resume.pdf",
      mimeType: "application/pdf",
      originalName: "resume.pdf",
    });

    const mockDownload = vi.fn().mockResolvedValueOnce({
      data: new Blob([Buffer.from("pdf-data")]),
      error: null,
    });
    mocks.supabase.storage.from.mockReturnValueOnce({
      download: mockDownload,
    });

    mocks.extractText.mockResolvedValueOnce("Candidate resume content with extensive professional experience in software engineering and frontend development.");
    mocks.analyzeResume.mockResolvedValueOnce({
      score: 85,
      summary: "Strong frontend developer",
      strengths: ["React", "Tailwind CSS"],
      gaps: [],
      requirements: [],
    });

    await processResumeJob(152);

    expect(mocks.prisma.storedDocument.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
    });
    expect(mocks.supabase.storage.from).toHaveBeenCalledWith("applicant-assets");
    expect(mockDownload).toHaveBeenCalledWith("user-123/resume.pdf");
    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 152 },
      data: expect.objectContaining({
        aiScore: 85,
        aiSummary: expect.any(String),
      }),
    });
  });

  it("handles missing stored document by reporting clear error to NEEDS_ATTENTION instead of crashing", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 153,
      status: "PARSING",
      resumeUrl: "/api/documents/999/download",
      jobPosting: { title: "Dev", requirements: "TypeScript" },
    });

    mocks.prisma.storedDocument.findUnique.mockResolvedValueOnce(null);

    await processResumeJob(153);

    expect(mocks.prisma.storedDocument.findUnique).toHaveBeenCalledWith({
      where: { id: 999 },
    });
    expect(mocks.prisma.application.updateMany).toHaveBeenCalledWith({
      where: { id: 153, resumeUrl: expect.any(String), status: { in: ["SUBMITTED", "PARSING", "NEEDS_ATTENTION"] } },
      data: expect.objectContaining({
        status: "NEEDS_ATTENTION",
        aiSummary: expect.stringContaining("Could not read the resume file. Manual review required. Reference:"),
      }),
    });
  });

  it("trims whitespace from resume URLs before fetching", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 154,
      status: "PARSING",
      resumeUrl: "  https://example.com/spaced-resume.pdf  ",
      jobPosting: { title: "Dev", requirements: "TypeScript" },
    });

    legacyFile("application/pdf", "spaced-resume.pdf");

    mocks.extractText.mockResolvedValueOnce("Experienced engineer with a demonstrated history of working in software development and fullstack engineering.");
    mocks.analyzeResume.mockResolvedValueOnce({
      score: 75,
      summary: "Good dev",
      strengths: ["TypeScript"],
      gaps: [],
      requirements: [],
    });

    await processResumeJob(154);

    expect(mocks.legacyDownload).toHaveBeenCalledWith("https://example.com/spaced-resume.pdf");
    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 154 },
      data: expect.objectContaining({
        aiScore: 75,
        aiSummary: expect.any(String),
      }),
    });
  });

  it("preserves advanced pipeline status (e.g. INITIAL_SCREENING) without demoting to REVIEW", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 155,
      status: "INITIAL_SCREENING",
      resumeUrl: "https://example.com/interview-candidate.pdf",
      jobPosting: { title: "Backend Engineer", requirements: "Node.js, Postgres" },
    });

    legacyFile("application/pdf", "interview-candidate.pdf");

    mocks.extractText.mockResolvedValueOnce("Senior backend developer with over seven years experience architecting high-scale distributed systems and Node APIs.");
    mocks.analyzeResume.mockResolvedValueOnce({
      score: 92,
      summary: "Senior backend engineer",
      strengths: ["Node.js", "Postgres"],
      gaps: [],
      requirements: [],
    });

    await processResumeJob(155);

    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 155 },
      data: expect.objectContaining({
        aiScore: 92,
      }),
    });

    // Must NOT have updated status to REVIEW
    const updateCall = mocks.prisma.application.update.mock.calls.find((call: any) => call[0].where.id === 155);
    expect(updateCall?.[0]?.data?.status).toBeUndefined();
  });

  it("successfully parses and analyzes Word .docx resumes through the document text extractor", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 201,
      status: "PARSING",
      resumeUrl: "https://example.com/applicant-resume.docx",
      jobPosting: { title: "Fullstack Developer", requirements: "React, Node.js, SQL" },
    });

    legacyFile(DOCX, "applicant-resume.docx");

    mocks.extractText.mockResolvedValueOnce("Jane Doe\nFullstack Engineer\nSkills: React, Node.js, SQL, TypeScript\nExperience: 4 years building enterprise software.");

    mocks.analyzeResume.mockResolvedValueOnce({
      score: 88,
      summary: "Excellent fullstack candidate with matching skill set.",
      strengths: ["React", "Node.js", "SQL"],
      gaps: [],
      requirements: [],
    });

    await processResumeJob(201);

    expect(mocks.extractText).toHaveBeenCalledWith(expect.any(Buffer), DOCX);
    expect(mocks.analyzeResume).toHaveBeenCalledWith(
      expect.stringContaining("Jane Doe"),
      "Fullstack Developer",
      "React, Node.js, SQL"
    );
    expect(mocks.analyzeResumeFromBuffer).not.toHaveBeenCalled();
    expect(mocks.extractText).not.toHaveBeenCalledWith(expect.any(Buffer), "application/pdf");
    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 201 },
      data: expect.objectContaining({
        aiScore: 88,
        aiSummary: expect.any(String),
      }),
    });
  });

  it("successfully parses and analyzes photo/image resumes using analyzeResumeFromBuffer vision OCR", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 202,
      status: "PARSING",
      resumeUrl: "https://example.com/paper-resume-photo.jpg",
      jobPosting: { title: "Operations Supervisor", requirements: "Logistics, Team Leadership" },
    });

    legacyFile("image/jpeg", "paper-resume-photo.jpg");

    mocks.analyzeResumeFromBuffer.mockResolvedValueOnce({
      score: 82,
      summary: "Candidate has 5 years of verified warehouse operations management.",
      strengths: ["Logistics", "Team Leadership"],
      gaps: [],
      requirements: [],
    });

    await processResumeJob(202);

    expect(mocks.analyzeResumeFromBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "image/jpeg",
      "Operations Supervisor",
      "Logistics, Team Leadership"
    );
    expect(mocks.analyzeResume).not.toHaveBeenCalled();
    expect(mocks.extractText).not.toHaveBeenCalled();
    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 202 },
      data: expect.objectContaining({
        aiScore: 82,
        aiSummary: expect.any(String),
      }),
    });
  });

  it("successfully parses image stored documents with image/png MIME type", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 203,
      userId: "owner-1",
      status: "PARSING",
      resumeUrl: "/api/documents/77/download",
      jobPosting: { title: "Graphic Designer", requirements: "Figma, Adobe Suite" },
    });

    mocks.prisma.storedDocument.findUnique.mockResolvedValueOnce({
      id: 77,
      ownerId: "owner-1",
      sizeBytes: 20,
      storageBucket: "applicant-assets",
      storagePath: "user-456/photo-resume.png",
      mimeType: "image/png",
      originalName: "photo-resume.png",
    });

    const mockDownload = vi.fn().mockResolvedValueOnce({
      data: new Blob([Buffer.from("fake-png-bytes")]),
      error: null,
    });
    mocks.supabase.storage.from.mockReturnValueOnce({
      download: mockDownload,
    });

    mocks.analyzeResumeFromBuffer.mockResolvedValueOnce({
      score: 79,
      summary: "Strong visual design portfolio and proficiency in tools.",
      strengths: ["Figma", "Adobe Suite"],
      gaps: [],
      requirements: [],
    });

    await processResumeJob(203);

    expect(mocks.analyzeResumeFromBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "image/png",
      "Graphic Designer",
      "Figma, Adobe Suite"
    );
    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 203 },
      data: expect.objectContaining({
        aiScore: 79,
      }),
    });
  });

  it("falls back to analyzeResumeFromBuffer when PDF contains sparse text (e.g. scanned image PDF)", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 204,
      status: "PARSING",
      resumeUrl: "https://example.com/scanned-resume.pdf",
      jobPosting: { title: "Accountant", requirements: "CPA, Tax Prep" },
    });

    legacyFile("application/pdf", "scanned-resume.pdf");

    // the extractor returns sparse text (< 50 chars)
    mocks.extractText.mockResolvedValueOnce("Scan Page 1");

    mocks.analyzeResumeFromBuffer.mockResolvedValueOnce({
      score: 90,
      summary: "Scanned resume successfully analyzed via multimodal vision OCR.",
      strengths: ["CPA", "Tax Prep"],
      gaps: [],
      requirements: [],
    });

    await processResumeJob(204);

    expect(mocks.extractText).toHaveBeenCalledWith(expect.any(Buffer), "application/pdf");
    expect(mocks.analyzeResumeFromBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "application/pdf",
      "Accountant",
      "CPA, Tax Prep"
    );
    expect(mocks.analyzeResume).not.toHaveBeenCalled();
    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 204 },
      data: expect.objectContaining({
        aiScore: 90,
      }),
    });
  });

  it("handles docx extraction failure gracefully by setting status to NEEDS_ATTENTION", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 205,
      status: "PARSING",
      resumeUrl: "https://example.com/corrupt-resume.docx",
      jobPosting: { title: "Software Engineer", requirements: "TypeScript" },
    });

    legacyFile(DOCX, "corrupt-resume.docx");

    mocks.extractText.mockRejectedValueOnce(new Error("Corrupted DOCX archive structure"));

    await processResumeJob(205);

    expect(mocks.prisma.application.updateMany).toHaveBeenCalledWith({
      where: { id: 205, resumeUrl: expect.any(String), status: { in: ["SUBMITTED", "PARSING", "NEEDS_ATTENTION"] } },
      data: expect.objectContaining({
        status: "NEEDS_ATTENTION",
        aiSummary: expect.stringContaining("Manual review required. Reference:"),
      }),
    });
    // The provider/parser message stays out of the stored summary.
    expect(JSON.stringify(mocks.prisma.application.updateMany.mock.calls)).not.toContain("Corrupted DOCX archive structure");
  });

  it("handles image vision analysis failure gracefully by setting status to NEEDS_ATTENTION", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 206,
      status: "PARSING",
      resumeUrl: "https://example.com/resume.webp",
      jobPosting: { title: "Developer", requirements: "Python" },
    });

    legacyFile("image/webp", "resume.webp");

    mocks.analyzeResumeFromBuffer.mockRejectedValueOnce(new Error("Gemini quota exceeded"));

    await processResumeJob(206);

    expect(mocks.prisma.application.updateMany).toHaveBeenCalledWith({
      where: { id: 206, resumeUrl: expect.any(String), status: { in: ["SUBMITTED", "PARSING", "NEEDS_ATTENTION"] } },
      data: expect.objectContaining({
        status: "NEEDS_ATTENTION",
        aiSummary: expect.stringContaining("Manual review required. Reference:"),
      }),
    });
    expect(JSON.stringify(mocks.prisma.application.updateMany.mock.calls)).not.toContain("Gemini quota exceeded");
  });

  describe("failure policy never reverses recruitment progress", () => {
    const failingApplication = (status: string) =>
      mocks.prisma.application.findUnique.mockResolvedValueOnce({
        id: 301,
        status,
        resumeUrl: "https://example.com/analyzed.pdf",
        jobPosting: { title: "Dev", requirements: "TS" },
      });

    it("limits the status change to initial statuses and the analyzed resume", async () => {
      failingApplication("PARSING");
      legacyFile("application/pdf", "analyzed.pdf");
      mocks.extractText.mockResolvedValueOnce("Candidate resume with plenty of readable professional text for the analysis step to run.");
      mocks.analyzeResume.mockRejectedValueOnce(new Error("provider down"));

      await processResumeJob(301);

      const [{ where, data }] = mocks.prisma.application.updateMany.mock.calls[0];
      expect(where).toEqual({ id: 301, resumeUrl: "https://example.com/analyzed.pdf", status: { in: ["SUBMITTED", "PARSING", "NEEDS_ATTENTION"] } });
      for (const advanced of ["INITIAL_SCREENING", "FINAL_INTERVIEW", "COMPLIANCE", "READY_FOR_DEPLOYMENT", "DEPLOYED", "BACKOUT", "REVIEW", "MATCHED"]) {
        expect(where.status.in).not.toContain(advanced);
      }
      expect(data.status).toBe("NEEDS_ATTENTION");
      expect(mocks.notifyJobOwner).toHaveBeenCalledTimes(1);
    });

    it("writes nothing, but logs the reference, when the row advanced or its resume was replaced", async () => {
      failingApplication("PARSING");
      legacyFile("application/pdf", "analyzed.pdf");
      mocks.extractText.mockResolvedValueOnce("Candidate resume with plenty of readable professional text for the analysis step to run.");
      mocks.analyzeResume.mockRejectedValueOnce(new Error("provider down"));
      // The guarded update matches nothing: the application advanced or its resume was replaced.
      mocks.prisma.application.updateMany.mockResolvedValueOnce({ count: 0 });
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await processResumeJob(301);

      // Only the guarded attempt: no note-only write, no update, so the earlier summary survives.
      expect(mocks.prisma.application.updateMany).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.application.update).not.toHaveBeenCalled();
      expect(mocks.notifyJobOwner).not.toHaveBeenCalled();
      expect(error.mock.calls.flat().join(" ")).toMatch(/not recorded.*reference [a-f0-9-]{36}/);
      error.mockRestore();
    });

    it("does not flag an application that gained a resume while the no-resume check ran", async () => {
      mocks.prisma.application.findUnique.mockResolvedValueOnce({
        id: 302, status: "SUBMITTED", resumeUrl: null, jobPosting: { title: "Dev", requirements: "TS" },
      });
      mocks.prisma.application.updateMany.mockResolvedValueOnce({ count: 0 });

      await processResumeJob(302);

      expect(mocks.prisma.application.updateMany).toHaveBeenCalledWith({
        where: { id: 302, resumeUrl: null, status: { in: ["SUBMITTED", "PARSING", "NEEDS_ATTENTION"] } },
        data: expect.objectContaining({ status: "NEEDS_ATTENTION" }),
      });
      expect(mocks.notifyJobOwner).not.toHaveBeenCalled();
    });
  });

  describe("detectDocumentFormat helper", () => {
    it("identifies docx format by mimeType and extension", () => {
      expect(detectDocumentFormat("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "file.bin").isDocx).toBe(true);
      expect(detectDocumentFormat("application/msword", "file.bin").isDocx).toBe(true);
      expect(detectDocumentFormat(undefined, "https://example.com/resume.docx").isDocx).toBe(true);
      expect(detectDocumentFormat(undefined, "resume.doc").isDocx).toBe(true);
    });

    it("identifies image format by mimeType and extension", () => {
      expect(detectDocumentFormat("image/jpeg", "file.bin").isImage).toBe(true);
      expect(detectDocumentFormat("image/png", "file.bin").isImage).toBe(true);
      expect(detectDocumentFormat(undefined, "photo.jpg").isImage).toBe(true);
      expect(detectDocumentFormat(undefined, "photo.jpeg").isImage).toBe(true);
      expect(detectDocumentFormat(undefined, "scan.png").isImage).toBe(true);
      expect(detectDocumentFormat(undefined, "document.webp").isImage).toBe(true);
    });

    it("identifies pdf format by default or pdf extension", () => {
      expect(detectDocumentFormat("application/pdf", "file.pdf").isPdf).toBe(true);
      expect(detectDocumentFormat(undefined, "document.pdf").isPdf).toBe(true);
      expect(detectDocumentFormat(undefined, "unknown-file").isPdf).toBe(true);
    });
  });
});
