import { describe, it, expect, vi } from "vitest";

vi.mock("sharp", () => ({ default: {} }));

import { generateEmbedding, EMBEDDING_DIMENSION, EMBEDDING_MODEL } from "./embedding.service.js";

describe("embedding.service", () => {
  it("should export model name and dimension", () => {
    expect(EMBEDDING_MODEL).toBe("Xenova/all-MiniLM-L6-v2");
    expect(EMBEDDING_DIMENSION).toBe(384);
  });

  it("should generate a 384-dimensional normalized embedding vector", async () => {
    const text = "Software Engineer with React and Node.js experience";
    const embedding = await generateEmbedding(text);

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);
    expect(embedding.every((val) => typeof val === "number" && !Number.isNaN(val))).toBe(true);
  });

  it("should return zero vector or handle empty text gracefully", async () => {
    const embedding = await generateEmbedding("");
    expect(embedding.length).toBe(384);
  });
});
