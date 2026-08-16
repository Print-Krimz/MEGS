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
  pdfParse: vi.fn(),
}));

vi.mock("../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../utils/supabase.js", () => ({ default: mocks.supabase }));
vi.mock("../utils/gemini.js", () => ({ analyzeResume: mocks.analyzeResume }));
vi.mock("pdf-parse", () => ({ default: mocks.pdfParse }));
vi.mock("pdf-parse/lib/pdf-parse.js", () => ({ default: mocks.pdfParse }));

// Mock global fetch
global.fetch = vi.fn();

import { processResumeJob } from "./resume.worker.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Resume Worker AI Routing Policy", () => {
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

    mocks.pdfParse.mockResolvedValueOnce({ text: "Candidate resume content" });
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
    });

    const mockDownload = vi.fn().mockResolvedValueOnce({
      data: new Blob([Buffer.from("pdf-data")]),
      error: null,
    });
    mocks.supabase.storage.from.mockReturnValueOnce({
      download: mockDownload,
    });

    mocks.pdfParse.mockResolvedValueOnce({ text: "Candidate resume content" });
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

    mocks.pdfParse.mockResolvedValueOnce({ text: "Resume content" });
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

    mocks.pdfParse.mockResolvedValueOnce({ text: "Resume with strong Node experience" });
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
});


