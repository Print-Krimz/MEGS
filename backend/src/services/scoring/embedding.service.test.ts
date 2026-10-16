import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEmbedContent = vi.hoisted(() => vi.fn());

// Mock the SDK (not utils/gemini.js) so the real capacity queue and deadline wrapper run.
vi.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { embedContent: mockEmbedContent }; },
}));

import {
  generateEmbedding,
  generateJobEmbedding,
  EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
} from "./embedding.service.js";

describe("embedding.service (Gemini Embeddings 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "synthetic");
  });

  it("should export default model name and 768 dimension", () => {
    expect(DEFAULT_EMBEDDING_MODEL).toBe("gemini-embedding-001");
    expect(EMBEDDING_DIMENSION).toBe(768);
  });

  it("should generate a 768-dimensional L2-normalized embedding vector using Gemini API", async () => {
    const fakeRawValues = new Array(768).fill(2); // non-unit values to verify L2 normalization
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: fakeRawValues }],
    });

    const text = "Senior TypeScript Engineer with React and PostgreSQL experience";
    const embedding = await generateEmbedding(text, { taskType: "RETRIEVAL_DOCUMENT" });

    expect(mockEmbedContent).toHaveBeenCalledWith({
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 768,
        taskType: "RETRIEVAL_DOCUMENT",
        abortSignal: expect.any(AbortSignal),
      },
    });

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(768);
    expect(embedding.every((val) => typeof val === "number" && !Number.isNaN(val))).toBe(true);

    // Verify L2 normalization: Euclidean length should equal 1
    const l2Norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(l2Norm).toBeCloseTo(1.0, 4);
  });

  it("should default taskType to SEMANTIC_SIMILARITY if not specified", async () => {
    const fakeRawValues = new Array(768).fill(1);
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: fakeRawValues }],
    });

    await generateEmbedding("Full Stack Developer");

    expect(mockEmbedContent).toHaveBeenCalledWith({
      model: "gemini-embedding-001",
      contents: "Full Stack Developer",
      config: {
        outputDimensionality: 768,
        taskType: "SEMANTIC_SIMILARITY",
        abortSignal: expect.any(AbortSignal),
      },
    });
  });

  it("should handle empty or whitespace text gracefully", async () => {
    const fakeRawValues = new Array(768).fill(1);
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: fakeRawValues }],
    });

    const embedding = await generateEmbedding("   ");

    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: "empty",
      })
    );
    expect(embedding.length).toBe(768);
  });

  it("should throw an error if Gemini returns mismatched dimensions", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: [0.1, 0.2, 0.3] }], // 3 dimensions instead of 768
    });

    await expect(generateEmbedding("Test")).rejects.toThrow(/Expected embedding dimension 768/);
  });

  it("should throw an error if Gemini returns empty embedding response", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [],
    });

    await expect(generateEmbedding("Test")).rejects.toThrow(/Gemini returned an empty embedding response/);
  });

  it("reuses identical cleaned job/MRF text while distinguishing case or requirement edits", async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: new Array(768).fill(1) }],
    });

    const first = await generateJobEmbedding("Unique hiring profile   Platform engineer");
    first[0] = 999;
    const trimmedMatch = await generateJobEmbedding("  Unique hiring profile   Platform engineer  ");
    const changedCase = await generateJobEmbedding("unique hiring profile   Platform engineer");
    const changedJob = await generateJobEmbedding("Unique hiring profile Platform engineer with Go");

    expect(mockEmbedContent).toHaveBeenCalledTimes(3);
    expect(trimmedMatch[0]).not.toBe(999);
    expect(changedJob).toHaveLength(768);
  });
});

