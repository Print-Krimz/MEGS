import { getGeminiClient, withGeminiCapacity } from "../../utils/gemini.js";
import { withProviderRetry } from "../../security/provider-retry.js";
import { createHash } from "crypto";

export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
export const EMBEDDING_DIMENSION = 768;

export type EmbeddingTaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING";

export interface GenerateEmbeddingOptions {
  taskType?: EmbeddingTaskType;
}

// Large enough to hold every open job (redeployment suggestions embed up to 60 at once).
const JOB_EMBEDDING_CACHE_LIMIT = 256;
const jobEmbeddingCache = new Map<string, number[] | Promise<number[]>>();

/** Reuse normalized job/MRF embeddings; candidate eligibility remains a fresh database query. */
export const generateJobEmbedding = async (text: string): Promise<number[]> => {
  const taskType: EmbeddingTaskType = "RETRIEVAL_QUERY";
  const model = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const cleanedText = text.trim() || "empty";
  const contentHash = createHash("sha256").update(cleanedText).digest("hex");
  const key = `${model}:${taskType}:${EMBEDDING_DIMENSION}:${contentHash}`;
  const cached = jobEmbeddingCache.get(key);
  if (cached) {
    jobEmbeddingCache.delete(key);
    jobEmbeddingCache.set(key, cached);
    return Array.isArray(cached) ? [...cached] : [...await cached];
  }

  const pending = generateEmbedding(text, { taskType });
  jobEmbeddingCache.set(key, pending);
  while (jobEmbeddingCache.size > JOB_EMBEDDING_CACHE_LIMIT) {
    const oldestKey = jobEmbeddingCache.keys().next().value;
    if (oldestKey === undefined) break;
    jobEmbeddingCache.delete(oldestKey);
  }

  try {
    const vector = await pending;
    if (jobEmbeddingCache.get(key) === pending) jobEmbeddingCache.set(key, [...vector]);
    return [...vector];
  } catch (error) {
    if (jobEmbeddingCache.get(key) === pending) jobEmbeddingCache.delete(key);
    throw error;
  }
};

const GEMINI_BATCH_LIMIT = 100;

/**
 * Batch form of generateJobEmbedding: cached texts are reused and the rest are sent
 * to Gemini in as few requests as possible. Results are returned in input order.
 */
export const generateJobEmbeddings = async (texts: string[]): Promise<number[][]> => {
  const taskType: EmbeddingTaskType = "RETRIEVAL_QUERY";
  const model = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const cleaned = texts.map((text) => text.trim() || "empty");
  const keys = cleaned.map((text) => `${model}:${taskType}:${EMBEDDING_DIMENSION}:${createHash("sha256").update(text).digest("hex")}`);

  const results: Array<number[] | undefined> = await Promise.all(
    keys.map(async (key) => {
      const cached = jobEmbeddingCache.get(key);
      return cached ? [...(Array.isArray(cached) ? cached : await cached)] : undefined;
    })
  );

  const missing = [...new Set(keys.filter((_, index) => !results[index]))];
  for (let start = 0; start < missing.length; start += GEMINI_BATCH_LIMIT) {
    const chunk = missing.slice(start, start + GEMINI_BATCH_LIMIT);
    const response = await withGeminiCapacity(() => withProviderRetry(() => getGeminiClient().models.embedContent({
      model,
      contents: chunk.map((key) => cleaned[keys.indexOf(key)]),
      config: { outputDimensionality: EMBEDDING_DIMENSION, taskType },
    })));
    chunk.forEach((key, index) => {
      const values = response.embeddings?.[index]?.values;
      if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSION) {
        throw new Error("Gemini returned an incomplete batch embedding response");
      }
      jobEmbeddingCache.set(key, l2Normalize(values));
    });
  }
  while (jobEmbeddingCache.size > JOB_EMBEDDING_CACHE_LIMIT) {
    const oldestKey = jobEmbeddingCache.keys().next().value;
    if (oldestKey === undefined) break;
    jobEmbeddingCache.delete(oldestKey);
  }

  return keys.map((key, index) => {
    const vector = results[index] ?? jobEmbeddingCache.get(key);
    if (!Array.isArray(vector)) throw new Error("Job embedding missing after batch request");
    return [...vector];
  });
};

export const l2Normalize = (vector: number[]): number[] => {
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
};

export const generateEmbedding = async (
  text: string,
  options: GenerateEmbeddingOptions = {}
): Promise<number[]> => {
  const cleanText = text.trim() || "empty";
  const taskType = options.taskType ?? "SEMANTIC_SIMILARITY";
  const model = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

  const ai = getGeminiClient();
  const response = await withGeminiCapacity(() => withProviderRetry(() => ai.models.embedContent({
    model,
    contents: cleanText,
    config: {
      outputDimensionality: EMBEDDING_DIMENSION,
      taskType,
    },
  })));

  const embeddingObj = response.embeddings?.[0];
  if (!embeddingObj || !Array.isArray(embeddingObj.values) || embeddingObj.values.length === 0) {
    throw new Error("Gemini returned an empty embedding response");
  }

  const rawArray = embeddingObj.values;
  if (rawArray.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Expected embedding dimension ${EMBEDDING_DIMENSION}, received ${rawArray.length}`);
  }

  return l2Normalize(rawArray);
};

