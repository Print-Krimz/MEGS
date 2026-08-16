import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: (...args: any[]) => mockGenerateContent(...args),
      },
    })),
  };
});

import { analyzeResume } from "./gemini.js";

describe("Gemini Resume Analysis Utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "mock-key";
  });

  it("uses gemini-2.0-flash or configured GEMINI_MODEL and parses JSON response", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        score: 88,
        summary: "Excellent candidate with required expertise.",
        strengths: ["TypeScript", "Node.js", "PostgreSQL"],
        gaps: ["No GraphQL experience"],
      }),
    });

    const result = await analyzeResume(
      "5 years TypeScript backend engineer",
      "Senior Backend Engineer",
      "Node.js, TypeScript, PostgreSQL"
    );

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
      })
    );

    expect(result).toEqual({
      score: 88,
      summary: "Excellent candidate with required expertise.",
      strengths: ["TypeScript", "Node.js", "PostgreSQL"],
      gaps: ["No GraphQL experience"],
    });
  });

  it("strips markdown json fences if model wraps response", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: "```json\n" + JSON.stringify({
        score: 70,
        summary: "Good fit.",
        strengths: ["Communication"],
        gaps: [],
      }) + "\n```",
    });

    const result = await analyzeResume("Resume text", "Manager", "Leadership");

    expect(result.score).toBe(70);
    expect(result.summary).toBe("Good fit.");
  });
});
