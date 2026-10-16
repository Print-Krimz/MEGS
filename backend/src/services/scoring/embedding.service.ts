import { embedContentWithDeadline } from "../../utils/gemini.js";
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

  // Resolve each unique key to a cached vector, someone else's pending promise, or one we own.
  const entries = new Map<string, number[] | Promise<number[]>>();
  const owned: Array<{ key: string; text: string; resolve: (v: number[]) => void; reject: (e: unknown) => void; promise: Promise<number[]> }> = [];
  keys.forEach((key, index) => {
    if (entries.has(key)) return;
    const cached = jobEmbeddingCache.get(key);
    if (cached) {
      jobEmbeddingCache.delete(key);
      jobEmbeddingCache.set(key, cached);
      entries.set(key, cached);
      return;
    }
    let resolve!: (v: number[]) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<number[]>((res, rej) => { resolve = res; reject = rej; });
    promise.catch(() => undefined); // waiters observe the rejection; avoid unhandled-rejection noise
    jobEmbeddingCache.set(key, promise);
    entries.set(key, promise);
    owned.push({ key, text: cleaned[index], resolve, reject, promise });
  });
  while (jobEmbeddingCache.size > JOB_EMBEDDING_CACHE_LIMIT) {
    const oldestKey = jobEmbeddingCache.keys().next().value;
    if (oldestKey === undefined) break;
    jobEmbeddingCache.delete(oldestKey);
  }

  // Cold keys are submitted after being published, so overlapping callers share this work.
  const failOwned = (items: typeof owned, error: unknown) => {
    for (const item of items) {
      if (jobEmbeddingCache.get(item.key) === item.promise) jobEmbeddingCache.delete(item.key);
      item.reject(error);
    }
  };
  void (async () => {
    for (let start = 0; start < owned.length; start += GEMINI_BATCH_LIMIT) {
      const chunk = owned.slice(start, start + GEMINI_BATCH_LIMIT);
      try {
        const response = await embedContentWithDeadline({
          model,
          contents: chunk.map((item) => item.text),
          config: { outputDimensionality: EMBEDDING_DIMENSION, taskType },
        });
        chunk.forEach((item, index) => {
          const values = response.embeddings?.[index]?.values;
          if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSION) {
            throw new Error("Gemini returned an incomplete batch embedding response");
          }
          const vector = l2Normalize(values);
          if (jobEmbeddingCache.get(item.key) === item.promise) jobEmbeddingCache.set(item.key, vector);
          item.resolve(vector);
        });
      } catch (error) {
        failOwned(owned.slice(start), error); // already-resolved entries ignore a second settle
        return;
      }
    }
  })();

  return Promise.all(keys.map(async (key) => [...await entries.get(key)!]));
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

  const response = await embedContentWithDeadline({
    model,
    contents: cleanText,
    config: {
      outputDimensionality: EMBEDDING_DIMENSION,
      taskType,
    },
  });

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

