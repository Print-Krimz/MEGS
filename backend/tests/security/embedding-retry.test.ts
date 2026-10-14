import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ embed: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { embedContent: provider.embed }; } }));
import { generateEmbedding, EMBEDDING_DIMENSION } from "../../src/services/scoring/embedding.service.js";

describe("resume embedding retry preserves scoring inputs", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("GEMINI_API_KEY", "synthetic"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  it("recovers throttling without changing model options, dimensions, or normalization", async () => {
    vi.useFakeTimers();
    const vector = Array.from({ length: EMBEDDING_DIMENSION }, (_, i) => i === 0 ? 3 : i === 1 ? 4 : 0);
    provider.embed.mockRejectedValueOnce({ status: 429 }).mockResolvedValue({ embeddings: [{ values: vector }] });
    const run = generateEmbedding("Candidate skills", { taskType: "RETRIEVAL_DOCUMENT" });
    await vi.runAllTimersAsync();
    const result = await run;
    expect(result).toHaveLength(768); expect(result[0]).toBeCloseTo(0.6); expect(result[1]).toBeCloseTo(0.8);
    expect(provider.embed).toHaveBeenCalledTimes(2);
    expect(provider.embed.mock.calls[0]![0]).toEqual(provider.embed.mock.calls[1]![0]);
    expect(provider.embed.mock.calls[0]![0].config).toEqual({ outputDimensionality: 768, taskType: "RETRIEVAL_DOCUMENT" });
  });
  it("preserves invalid-dimension rejection", async () => {
    provider.embed.mockResolvedValue({ embeddings: [{ values: [1, 2] }] });
    await expect(generateEmbedding("Candidate skills")).rejects.toThrow("Expected embedding dimension 768");
  });
});
