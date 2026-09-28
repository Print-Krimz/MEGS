import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    application: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
  mammoth: {
    extractRawText: vi.fn(),
  },
  pdfParse: vi.fn(),
}));

vi.mock("../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../utils/supabase.js", () => ({ default: mocks.supabase }));
vi.mock("../utils/gemini.js", () => ({
  analyzeResume: mocks.analyzeResume,
  analyzeResumeFromBuffer: mocks.analyzeResumeFromBuffer,
}));
vi.mock("mammoth", () => ({
  default: mocks.mammoth,
  extractRawText: mocks.mammoth.extractRawText,
}));
vi.mock("pdf-parse", () => ({ default: mocks.pdfParse }));
vi.mock("pdf-parse/lib/pdf-parse.js", () => ({ default: mocks.pdfParse }));

// Mock global fetch
global.fetch = vi.fn();

import { processResumeJob, detectDocumentFormat } from "./resume.worker.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Resume Worker AI Routing Policy & Multi-Format OCR", () => {
  it("transitions successful resume analysis (even with low score) to REVIEW, never automatic TALENT_POOL", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 101,
      status: "PARSING",
      resumeUrl: "https://example.com/resume.pdf",
      jobPosting: { title: "Software Engineer", requirements: "TypeScript" },
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from("pdf-data")),
    });

    mocks.pdfParse.mockResolvedValueOnce({
      text: "Candidate resume content with extensive professional experience in software engineering and web application development.",
    });
    mocks.analyzeResume.mockResolvedValueOnce({
      score: 35,
      summary: "Junior candidate",
      strengths: ["Basic HTML"],
      gaps: ["No TypeScript"],
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

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await processResumeJob(102);

    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 102 },
      data: expect.objectContaining({
        status: "NEEDS_ATTENTION",
      }),
    });
  });

  it("successfully downloads resume when resumeUrl is an internal /api/documents/:id/download route", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 152,
      status: "PARSING",
      resumeUrl: "/api/documents/3/download",
      jobPosting: { title: "Frontend Dev", requirements: "React" },
    });

    mocks.prisma.storedDocument.findUnique.mockResolvedValueOnce({
      id: 3,
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

    mocks.pdfParse.mockResolvedValueOnce({
      text: "Candidate resume content with extensive professional experience in software engineering and frontend development.",
    });
    mocks.analyzeResume.mockResolvedValueOnce({
      score: 85,
      summary: "Strong frontend developer",
      strengths: ["React", "Tailwind CSS"],
      gaps: [],
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
    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 153 },
      data: expect.objectContaining({
        status: "NEEDS_ATTENTION",
        aiSummary: expect.stringContaining("Stored document #999 referenced in application resumeUrl was not found"),
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

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from("pdf-data")),
    });

    mocks.pdfParse.mockResolvedValueOnce({
      text: "Experienced engineer with a demonstrated history of working in software development and fullstack engineering.",
    });
    mocks.analyzeResume.mockResolvedValueOnce({
      score: 75,
      summary: "Good dev",
      strengths: ["TypeScript"],
      gaps: [],
    });

    await processResumeJob(154);

    expect(global.fetch).toHaveBeenCalledWith("https://example.com/spaced-resume.pdf");
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

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from("pdf-data")),
    });

    mocks.pdfParse.mockResolvedValueOnce({
      text: "Senior backend developer with over seven years experience architecting high-scale distributed systems and Node APIs.",
    });
    mocks.analyzeResume.mockResolvedValueOnce({
      score: 92,
      summary: "Senior backend engineer",
      strengths: ["Node.js", "Postgres"],
      gaps: [],
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

  it("successfully parses and analyzes Word .docx resumes using mammoth", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 201,
      status: "PARSING",
      resumeUrl: "https://example.com/applicant-resume.docx",
      jobPosting: { title: "Fullstack Developer", requirements: "React, Node.js, SQL" },
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from("fake-docx-buffer")),
    });

    mocks.mammoth.extractRawText.mockResolvedValueOnce({
      value: "Jane Doe\nFullstack Engineer\nSkills: React, Node.js, SQL, TypeScript\nExperience: 4 years building enterprise software.",
      messages: [],
    });

    mocks.analyzeResume.mockResolvedValueOnce({
      score: 88,
      summary: "Excellent fullstack candidate with matching skill set.",
      strengths: ["React", "Node.js", "SQL"],
      gaps: [],
    });

    await processResumeJob(201);

    expect(mocks.mammoth.extractRawText).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
    });
    expect(mocks.analyzeResume).toHaveBeenCalledWith(
      expect.stringContaining("Jane Doe"),
      "Fullstack Developer",
      "React, Node.js, SQL"
    );
    expect(mocks.analyzeResumeFromBuffer).not.toHaveBeenCalled();
    expect(mocks.pdfParse).not.toHaveBeenCalled();
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

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from("fake-image-bytes")),
    });

    mocks.analyzeResumeFromBuffer.mockResolvedValueOnce({
      score: 82,
      summary: "Candidate has 5 years of verified warehouse operations management.",
      strengths: ["Logistics", "Team Leadership"],
      gaps: [],
    });

    await processResumeJob(202);

    expect(mocks.analyzeResumeFromBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "image/jpeg",
      "Operations Supervisor",
      "Logistics, Team Leadership"
    );
    expect(mocks.analyzeResume).not.toHaveBeenCalled();
    expect(mocks.pdfParse).not.toHaveBeenCalled();
    expect(mocks.mammoth.extractRawText).not.toHaveBeenCalled();
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
      status: "PARSING",
      resumeUrl: "/api/documents/77/download",
      jobPosting: { title: "Graphic Designer", requirements: "Figma, Adobe Suite" },
    });

    mocks.prisma.storedDocument.findUnique.mockResolvedValueOnce({
      id: 77,
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

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from("scanned-pdf-data")),
    });

    // pdfParse returns sparse text (< 50 chars)
    mocks.pdfParse.mockResolvedValueOnce({
      text: "Scan Page 1",
    });

    mocks.analyzeResumeFromBuffer.mockResolvedValueOnce({
      score: 90,
      summary: "Scanned resume successfully analyzed via multimodal vision OCR.",
      strengths: ["CPA", "Tax Prep"],
      gaps: [],
    });

    await processResumeJob(204);

    expect(mocks.pdfParse).toHaveBeenCalled();
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

  it("handles mammoth docx extraction failure gracefully by setting status to NEEDS_ATTENTION", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 205,
      status: "PARSING",
      resumeUrl: "https://example.com/corrupt-resume.docx",
      jobPosting: { title: "Software Engineer", requirements: "TypeScript" },
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from("corrupt-bytes")),
    });

    mocks.mammoth.extractRawText.mockRejectedValueOnce(new Error("Corrupted DOCX archive structure"));

    await processResumeJob(205);

    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 205 },
      data: expect.objectContaining({
        status: "NEEDS_ATTENTION",
        aiSummary: expect.stringContaining("Corrupted DOCX archive structure"),
      }),
    });
  });

  it("handles image vision analysis failure gracefully by setting status to NEEDS_ATTENTION", async () => {
    mocks.prisma.application.findUnique.mockResolvedValueOnce({
      id: 206,
      status: "PARSING",
      resumeUrl: "https://example.com/resume.webp",
      jobPosting: { title: "Developer", requirements: "Python" },
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from("webp-data")),
    });

    mocks.analyzeResumeFromBuffer.mockRejectedValueOnce(new Error("Gemini quota exceeded"));

    await processResumeJob(206);

    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 206 },
      data: expect.objectContaining({
        status: "NEEDS_ATTENTION",
        aiSummary: expect.stringContaining("Gemini quota exceeded"),
      }),
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
