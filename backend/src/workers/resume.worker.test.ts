import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    application: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  analyzeResume: vi.fn(),
  pdfParse: vi.fn(),
}));

vi.mock("../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../utils/gemini.js", () => ({ analyzeResume: mocks.analyzeResume }));
vi.mock("pdf-parse", () => ({ default: mocks.pdfParse }));

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
        status: "REVIEW",
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
    });

    await processResumeJob(102);

    expect(mocks.prisma.application.update).toHaveBeenCalledWith({
      where: { id: 102 },
      data: expect.objectContaining({
        status: "NEEDS_ATTENTION",
      }),
    });
  });
});
